@echo off
curl -X POST "https://api.telegram.org/bot8516139591:AAGwzsjcfTJ18L4Xj8TH9vG61RRtwp7IKeo/sendMessage" -H "Content-Type: application/json; charset=utf-8" --data-binary @telegram_post.json
