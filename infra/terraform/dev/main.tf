# ==========================================
# GCP Provider設定
# ==========================================
terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# ==========================================
# 変数定義
# ==========================================
variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "asia-northeast1"
}

variable "notification_email" {
  description = "Email for budget alerts"
  type        = string
  default     = "over9131120@gmail.com"
}

variable "min_instances" {
  description = "Minimum number of Cloud Run instances"
  type        = number
  default     = 0
}

# ==========================================
# Artifact Registry
# ==========================================
resource "google_artifact_registry_repository" "main" {
  location      = var.region
  repository_id = "line-booking-system"
  description   = "Docker repository for LINE booking system"
  format        = "DOCKER"
  
  cleanup_policies {
    id     = "keep-recent-versions"
    action = "KEEP"
    
    condition {
      tag_prefixes  = ["v", "prod"]
      newer_than    = "30d"
    }
  }
  
  cleanup_policies {
    id     = "delete-old-versions"
    action = "DELETE"
    
    condition {
      older_than    = "60d"
    }
  }
}

# ==========================================
# Secret Manager
# ==========================================
resource "google_secret_manager_secret" "line_token" {
  secret_id = "line-channel-access-token"
  
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "line_token" {
  secret = google_secret_manager_secret.line_token.id
  secret_data = "2l2dPaFJzJm9dOGWUDWjSkTd4q6rPFCQyNlJCsjroXvp8ms5ixN5y5wLaWkdL7yvbjGhrREmcrINg4sT+8/nKhExKuolhDSfddrgv9ZNqHwamM43ELsG51/IVWsdaRTxnAyRHCj6+pdQrhQmnw1f/wdB04t89/1O/w1cDnyilFU="
}

resource "google_secret_manager_secret" "line_secret" {
  secret_id = "line-channel-secret"
  
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "line_secret" {
  secret = google_secret_manager_secret.line_secret.id
  secret_data = "c093c9b8e2c2e80ce48f039e6833f636"
}

resource "google_secret_manager_secret" "supabase_url" {
  secret_id = "supabase-url"
  
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "supabase_url" {
  secret = google_secret_manager_secret.supabase_url.id
  secret_data = "https://faenvzzeguvlconvrqgp.supabase.co"
}

resource "google_secret_manager_secret" "supabase_key" {
  secret_id = "supabase-anon-key"
  
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "supabase_key" {
  secret = google_secret_manager_secret.supabase_key.id
  secret_data = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhZW52enplZ3V2bGNvbnZycWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNzQyOTgsImV4cCI6MjA3MTc1MDI5OH0.U_v82IYSDM3waCFfFr4e7MpbTQmZFRPCNaA-2u5R3d8"
}

# ==========================================
# Cloud Run Service
# ==========================================
resource "google_cloud_run_service" "app" {
  name     = "line-booking-api-dev"
  location = var.region
  
  template {
    spec {
      containers {
        image = "${var.region}-docker.pkg.dev/${var.project_id}/line-booking-system/app:latest"
        
        resources {
          limits = {
            cpu    = "1"
            memory = "512Mi"
          }
        }
        
        env {
          name = "NODE_ENV"
          value = "development"
        }
        
        env {
          name = "STORE_ID"
          value = "default-store"
        }
        
        env {
          name = "LIFF_ID"
          value = "2006487876-xd1A5qJB"
        }
        
        env {
          name = "LINE_CHANNEL_ACCESS_TOKEN"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.line_token.secret_id
              key  = "latest"
            }
          }
        }
        
        env {
          name = "LINE_CHANNEL_SECRET"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.line_secret.secret_id
              key  = "latest"
            }
          }
        }
        
        env {
          name = "SUPABASE_URL"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.supabase_url.secret_id
              key  = "latest"
            }
          }
        }
        
        env {
          name = "SUPABASE_ANON_KEY"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.supabase_key.secret_id
              key  = "latest"
            }
          }
        }
      }
    }
    
    metadata {
      annotations = {
        "autoscaling.knative.dev/minScale" = tostring(var.min_instances)
        "autoscaling.knative.dev/maxScale" = "100"
      }
    }
  }
  
  traffic {
    percent         = 100
    latest_revision = true
  }
}

# Cloud Runサービスを公開
resource "google_cloud_run_service_iam_member" "public" {
  service  = google_cloud_run_service.app.name
  location = google_cloud_run_service.app.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ==========================================
# Cloud Scheduler (定期実行)
# ==========================================
resource "google_cloud_scheduler_job" "health_check" {
  name             = "line-booking-health-check"
  description      = "Health check every 5 minutes"
  schedule         = "*/5 * * * *"
  time_zone        = "Asia/Tokyo"
  attempt_deadline = "30s"
  
  http_target {
    http_method = "GET"
    uri         = "${google_cloud_run_service.app.status[0].url}/api/ping"
  }
}

# ==========================================
# Budget Alert
# ==========================================
resource "google_billing_budget" "budget" {
  billing_account = var.billing_account_id
  display_name    = "LINE Booking System Budget"
  
  budget_filter {
    projects = ["projects/${var.project_id}"]
  }
  
  amount {
    specified_amount {
      currency_code = "JPY"
      units         = "1000"
    }
  }
  
  threshold_rules {
    threshold_percent = 0.5
    spend_basis      = "CURRENT_SPEND"
  }
  
  threshold_rules {
    threshold_percent = 0.9
    spend_basis      = "CURRENT_SPEND"
  }
  
  threshold_rules {
    threshold_percent = 1.0
    spend_basis      = "CURRENT_SPEND"
  }
  
  all_updates_rule {
    monitoring_notification_channels = [
      google_monitoring_notification_channel.email.name
    ]
  }
}

# ==========================================
# Monitoring & Alerting
# ==========================================
resource "google_monitoring_notification_channel" "email" {
  display_name = "Email Notification"
  type         = "email"
  
  labels = {
    email_address = var.notification_email
  }
}

resource "google_monitoring_alert_policy" "error_rate" {
  display_name = "Cloud Run Error Rate"
  combiner     = "OR"
  
  conditions {
    display_name = "Error rate > 5%"
    
    condition_threshold {
      filter     = "resource.type=\"cloud_run_revision\" AND metric.type=\"run.googleapis.com/request_count\" AND metric.labels.response_code_class=\"5xx\""
      duration   = "60s"
      comparison = "COMPARISON_GT"
      
      threshold_value = 0.05
      
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }
  
  notification_channels = [google_monitoring_notification_channel.email.name]
}

# ==========================================
# Logging Exclusions (コスト削減)
# ==========================================
resource "google_logging_project_exclusion" "health_checks" {
  name        = "exclude-health-checks"
  description = "Exclude health check logs"
  
  filter = "resource.type=\"cloud_run_revision\" AND httpRequest.requestUrl=\"/api/ping\""
  
  # 除外率100%
  disabled = false
}

resource "google_logging_project_exclusion" "info_logs" {
  name        = "exclude-info-logs"
  description = "Exclude INFO level logs"
  
  filter = "severity=\"INFO\" AND resource.type=\"cloud_run_revision\""
  
  # 除外率100%
  disabled = false
}

# ==========================================
# Output
# ==========================================
output "service_url" {
  value = google_cloud_run_service.app.status[0].url
}

output "webhook_url" {
  value = "${google_cloud_run_service.app.status[0].url}/webhook"
}