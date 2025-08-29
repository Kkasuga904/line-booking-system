@echo off
chcp 65001 >nul
gcloud run services describe line-booking-api --region asia-northeast1 --format "value(status.url)"