package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync/atomic"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/posthog/posthog/livestream/auth"
	"github.com/posthog/posthog/livestream/events"
	"github.com/redis/rueidis"
)

func Index(c echo.Context) error {
	return c.String(http.StatusOK, "RealTime Hog 3000")
}

type Counter struct {
	EventCount int
	UserCount  int
}

func ServedHandler(stats *events.Stats) func(c echo.Context) error {
	return func(c echo.Context) error {
		userCount := stats.GlobalStore.Len()
		count := stats.Counter.Count()
		resp := Counter{
			EventCount: count,
			UserCount:  userCount,
		}
		return c.JSON(http.StatusOK, resp)
	}
}

func StatsHandler(stats *events.Stats, sessionStats *events.SessionStats, redisStore *events.StatsInRedis) func(c echo.Context) error {
	return func(c echo.Context) error {

		type resp struct {
			UsersOnProduct   int    `json:"users_on_product,omitempty"`
			ActiveRecordings int    `json:"active_recordings,omitempty"`
			Error            string `json:"error,omitempty"`
		}

		_, token, err := auth.GetAuthClaims(c.Request().Header)
		if err != nil {
			return c.JSON(http.StatusUnauthorized, resp{Error: "wrong token claims"})
		}

		if redisStore != nil {
			ctx := c.Request().Context()
			userCount, userErr := redisStore.GetUserCount(ctx, token)
			sessionCount, sessionErr := redisStore.GetSessionCount(ctx, token)

			if userErr == nil && sessionErr == nil {
				if userCount == 0 && sessionCount == 0 {
					return c.JSON(http.StatusOK, resp{Error: "no stats"})
				}

				siteStats := resp{}
				siteStats.UsersOnProduct = int(userCount)
				siteStats.ActiveRecordings = int(sessionCount)

				return c.JSON(http.StatusOK, siteStats)
			}

			log.Printf("Redis read failed, falling back to local LRU: users_err=%v sessions_err=%v", userErr, sessionErr)
		}

		// Fallback to local LRU until V2 migration is complete
		userStore := stats.GetExistingStoreForToken(token)
		sessionCount := sessionStats.CountForToken(token)

		if userStore == nil && sessionCount == 0 {
			return c.JSON(http.StatusOK, resp{Error: "no stats"})
		}

		siteStats := resp{}
		if userStore != nil {
			siteStats.UsersOnProduct = userStore.Len()
		}
		if sessionCount != 0 {
			siteStats.ActiveRecordings = sessionCount
		}
		return c.JSON(http.StatusOK, siteStats)
	}
}

var subID uint64 = 1

func StreamEventsHandler(log echo.Logger, subChan chan events.Subscription, unSubChan chan events.Subscription) func(c echo.Context) error {
	return func(c echo.Context) error {
		log.Debugf("SSE client connected, ip: %v", c.RealIP())

		var (
			teamID  int
			token   string
			geoOnly bool
			err     error
		)

		teamID, token, err = auth.GetAuthClaims(c.Request().Header)
		if err != nil || token == "" || teamID == 0 {
			return echo.NewHTTPError(http.StatusUnauthorized, "wrong token")
		}

		eventType := c.QueryParam("eventType")
		distinctId := c.QueryParam("distinctId")
		geo := c.QueryParam("geo")

		if strings.ToLower(geo) == "true" || geo == "1" {
			geoOnly = true
		}

		var columns []string
		if _, hasColumns := c.QueryParams()["columns"]; hasColumns {
			columnsParam := strings.TrimSpace(c.QueryParam("columns"))
			if columnsParam != "" {
				columns = strings.Split(columnsParam, ",")
				for i, col := range columns {
					columns[i] = strings.TrimSpace(col)
				}
			} else {
				columns = []string{}
			}
		}

		var eventTypes []string
		if eventType != "" {
			eventTypes = strings.Split(eventType, ",")
		}

		subscription := events.Subscription{
			SubID:         atomic.AddUint64(&subID, 1),
			TeamId:        teamID,
			Token:         token,
			DistinctId:    distinctId,
			Geo:           geoOnly,
			Columns:       columns,
			EventTypes:    eventTypes,
			EventChan:     make(chan interface{}, 100),
			ShouldClose:   &atomic.Bool{},
			DroppedEvents: &atomic.Uint64{},
		}

		subChan <- subscription
		defer func() {
			subscription.ShouldClose.Store(true)
			unSubChan <- subscription
		}()

		w := c.Response()
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		timeout := time.After(30 * time.Minute)
		for {
			select {
			case <-timeout:
				log.Debug("SSE connection to be terminated after timeout")
				return nil
			case <-c.Request().Context().Done():
				log.Debugf("SSE client disconnected, ip: %v", c.RealIP())
				return nil
			case payload := <-subscription.EventChan:
				jsonData, err := json.Marshal(payload)
				if err != nil {
					// TODO capture error to PostHog
					log.Errorf("Error marshalling payload: %w", err)
					continue
				}

				event := Event{
					Data: jsonData,
				}
				if err := event.WriteTo(w); err != nil {
					return err
				}
				w.Flush()
			}
		}
	}
}

func NotificationsHandler(redisClient rueidis.Client) func(c echo.Context) error {
	return func(c echo.Context) error {
		_, userID, orgID, _, err := auth.GetAuthClaimsWithOrgID(c.Request().Header)
		if err != nil || userID == 0 || orgID == "" {
			return echo.NewHTTPError(http.StatusUnauthorized, "invalid token")
		}

		ctx := c.Request().Context()
		channel := fmt.Sprintf("notifications:%s", orgID)

		msgCh := make(chan string, 100)
		errCh := make(chan error, 1)

		go func() {
			errCh <- redisClient.Receive(ctx, redisClient.B().Subscribe().Channel(channel).Build(), func(msg rueidis.PubSubMessage) {
				select {
				case msgCh <- msg.Message:
				default:
				}
			})
		}()

		w := c.Response()
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")

		heartbeat := time.NewTicker(15 * time.Second)
		defer heartbeat.Stop()
		timeout := time.After(30 * time.Minute)

		for {
			select {
			case <-timeout:
				return nil
			case <-ctx.Done():
				return nil
			case err := <-errCh:
				if err != nil {
					log.Printf("Redis subscription error: %v", err)
				}
				return nil
			case payload := <-msgCh:
				if !isUserInResolvedIDs(payload, userID) {
					continue
				}
				cleaned := stripResolvedUserIDs(payload)
				event := Event{Data: []byte(cleaned)}
				if err := event.WriteTo(w); err != nil {
					return err
				}
				w.Flush()
			case <-heartbeat.C:
				event := Event{Comment: []byte("heartbeat")}
				if err := event.WriteTo(w); err != nil {
					return err
				}
				w.Flush()
			}
		}
	}
}

func isUserInResolvedIDs(payload string, userID int) bool {
	var data struct {
		ResolvedUserIDs []int `json:"resolved_user_ids"`
	}
	if err := json.Unmarshal([]byte(payload), &data); err != nil {
		return false
	}
	for _, id := range data.ResolvedUserIDs {
		if id == userID {
			return true
		}
	}
	return false
}

func stripResolvedUserIDs(payload string) string {
	var data map[string]interface{}
	if err := json.Unmarshal([]byte(payload), &data); err != nil {
		return payload
	}
	delete(data, "resolved_user_ids")
	cleaned, err := json.Marshal(data)
	if err != nil {
		return payload
	}
	return string(cleaned)
}
