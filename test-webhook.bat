@echo off
echo Testing webhook endpoint...
echo.
curl -X POST https://line-booking-api-116429620992.asia-northeast1.run.app/webhook -H "Content-Type: application/json" -d "{\"events\":[{\"type\":\"message\",\"message\":{\"type\":\"text\",\"text\":\"test\"},\"source\":{\"type\":\"user\",\"userId\":\"test-user\"},\"replyToken\":\"test-token\"}]}"
echo.
echo.
echo Check response above. Should return 200 OK.
pause