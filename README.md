# SmartServe AI: Intelligent Campus Service & Resource Management System

[![AWS Cloud](https://img.shields.io/badge/AWS-eu--north--1-orange?logo=amazon-aws)](https://aws.amazon.com/)
[![Node.js](https://img.shields.io/badge/Node.js-18.x-green?logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-blue?logo=react)](https://react.dev/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-blue?logo=mysql)](https://www.mysql.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A cloud-native, full-stack incident response and facility management system designed for university campuses. Built with **Amazon EC2, Amazon RDS MySQL, Amazon S3, AWS SSM Parameter Store, Amazon SQS, Amazon SNS, and Amazon CloudWatch**, featuring transparent local AI-assisted complaint categorization, priority scoring, and duplicate detection.

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Problem Statement & Objectives](#2-problem-statement--objectives)
3. [Key Features](#3-key-features)
4. [Technology Stack](#4-technology-stack)
5. [AWS Cloud Architecture & Services](#5-aws-cloud-architecture--services)
6. [Architecture Diagram](#6-architecture-diagram)
7. [Project Directory Structure](#7-project-directory-structure)
8. [Prerequisites & Local Setup](#8-prerequisites--local-setup)
9. [Environment Configuration](#9-environment-configuration)
10. [Database Schema & Initialization](#10-database-schema--initialization)
11. [Running Frontend & Backend](#11-running-frontend--backend)
12. [AWS Deployment Guide (eu-north-1)](#12-aws-deployment-guide-eu-north-1)
13. [Security & Least-Privilege IAM](#13-security--least-privilege-iam)
14. [Testing & Verification](#14-testing--verification)
15. [Cost Management & Resource Cleanup](#15-cost-management--resource-cleanup)

---

## 1. Project Overview

**SmartServe AI** modernizes campus maintenance operations by replacing slow paper registers, scattered emails, and verbal complaints with a centralized, intelligent service portal. Students can report facility issues (electrical sparks, plumbing leaks, Wi-Fi breakdowns, classroom projector failures) complete with photographs uploaded to Amazon S3. Administrators prioritize, assign work orders to campus technicians (e.g., electricians, network administrators, plumbers), track resolutions, and analyze campus hotspots through dynamic analytics.

The system incorporates a **lightweight, transparent local AI engine** that categorizes complaints, assigns urgency scores (1.0 to 10.0), and flags duplicate submissions using text similarity algorithms—eliminating reliance on expensive external paid AI APIs.

---

## 2. Problem Statement & Objectives

### The Problem
Traditional campus maintenance workflows suffer from:
- **Delayed response times** for critical safety hazards (e.g., electrical switchboard sparks, water leakages near laboratories).
- **Duplicate complaints** filed by multiple students for the same campus breakdown, causing wasted technician visits.
- **Lack of transparency** for students regarding ticket status and assigned staff.
- **Inadequate metrics** for facility managers to identify recurring building failures and equipment failure patterns.

### Project Objectives
1. **Develop a Multi-Tier Cloud Application**: Deploy a responsive React frontend, Express REST API, and managed MySQL database on AWS.
2. **Implement Network Isolation**: Secure application layers inside a custom Amazon VPC with public web subnets and isolated private database subnets.
3. **Automate Complaint Triage with Local AI**: Provide automatic categorization, safety urgency estimation, and duplicate detection.
4. **Secure Attachment Handling**: Store photos and supporting documents in private Amazon S3 buckets accessed strictly via temporary presigned URLs.
5. **Enforce Zero Hardcoded Secrets**: Load all sensitive database credentials and JWT signing keys at runtime from AWS Systems Manager Parameter Store via an EC2 IAM role.
6. **Ensure High Observability**: Stream centralized application logs and metrics to Amazon CloudWatch with proactive CPU alarms and AWS Budget cost alerts.

---

## 3. Key Features

### For Students
- **Secure Authentication**: Registration and login with JWT and bcrypt password hashing.
- **Interactive Ticket Submission**: File complaints specifying category, building, room details, and urgency.
- **Photo Upload to S3**: Attach photos or evidence directly to Amazon S3 with image preview and validation.
- **Real-Time AI Assistant**: Instant preview of suggested category, recommended priority, and safety warnings during typing.
- **Personal Complaint Tracker**: Monitor ticket lifecycle (`Submitted` &rarr; `Assigned` &rarr; `In Progress` &rarr; `Resolved`).
- **Student Data Privacy**: Tenant isolation ensuring students can only access their own submissions.

### For Maintenance Staff (Technicians)
- **Dedicated Staff Portal**: Technician view filtered strictly to tickets assigned to the logged-in staff member.
- **Detailed Work Orders**: Inspect student descriptions, location details, AI urgency ratings, and presigned photo attachments.
- **Status & Progress Updates**: Update status to `In Progress` or `Resolved` and log resolution remarks without the ability to modify admin-controlled priorities.

### For Campus Administrators
- **Operations Command Center**: Search, filter, and sort complaints across all categories, buildings, and statuses.
- **Technician Assignment**: Allocate tickets to electricians, plumbers, network engineers, or civil staff.
- **CSV Report Export**: Download live, structured audit reports for facilities meetings and accreditation records.
- **Campus Analytics Dashboard**: Visual distribution charts (Chart.js) showing breakdowns by category, building hotspots, and resolution rates.

---

## 4. Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite 6, Lucide React, Chart.js, React-ChartJS-2 |
| **Backend** | Node.js 18, Express 4.x, Multer, MySQL2 (Promise Pool) |
| **Authentication** | JSON Web Tokens (JWT), Bcrypt password hashing |
| **AI / NLP** | Local rule-based classifier, Sørensen-Dice token similarity, keyword urgency heuristic |
| **Cloud Platform** | Amazon Web Services (AWS) |
| **Cloud Compute** | Amazon EC2 (`t3.micro`, Amazon Linux 2023) |
| **Cloud Database** | Amazon RDS for MySQL 8.0 (`db.t3.micro`, gp3 storage) |
| **Storage & Messaging** | Amazon S3, Amazon SQS, Amazon SNS, AWS SSM Parameter Store |
| **Monitoring** | Amazon CloudWatch Logs, CloudWatch Metrics & Alarms, AWS Budgets |

---

## 5. AWS Cloud Architecture & Services

SmartServe AI genuinely integrates **8 AWS services**, fulfilling mandatory compute, networking, database, storage, security, and messaging requirements:

1. **Amazon EC2 (`t3.micro`)**: Hosts the Node.js Express API server and static React production build under `systemd` (`smartserve.service`).
2. **Amazon VPC**: Custom `10.0.0.0/16` network across 2 Availability Zones (`eu-north-1a`, `eu-north-1b`) with Internet Gateway, public subnets for web compute, and private isolated subnets for RDS.
3. **Amazon RDS for MySQL 8.0**: Managed relational database running in private subnets with automated backups, Multi-AZ subnets, and security groups restricted to EC2 inbound port 3306.
4. **Amazon S3**: Private bucket storing complaint photos. All public access is blocked; files are securely viewed through AWS SigV4 presigned URLs valid for 15 minutes.
5. **AWS Systems Manager (SSM) Parameter Store**: Stores `/smartserve/db/*` and `/smartserve/jwt/secret` (`SecureString`), queried at startup by the backend using IAM instance profile credentials.
6. **AWS IAM**: Role `SmartServe-EC2-Role` attached to the EC2 instance profile granting least-privilege permissions to SSM, S3, SQS, SNS, and CloudWatch without hardcoded access keys.
7. **Amazon SQS** *(Additional Capability 1)*: Asynchronous message queue buffering newly created complaints for decoupled downstream processing.
8. **Amazon SNS** *(Additional Capability 2)*: Publish-Subscribe topic publishing automated notifications when high-urgency complaints are submitted and resolved.
9. **Amazon CloudWatch**: Gathers runtime logs in `/smartserve/app`, tracks request latency, and triggers an alarm if EC2 CPU utilization exceeds 80%.
10. **AWS Budgets**: Automated cost-tracking alert notifying administrators via email if estimated monthly spend reaches 80% of a \$5.00 threshold.

---

## 6. Architecture Diagram

```mermaid
flowchart TD
    subgraph Users["Campus Clients"]
        Student["Student (Web / Mobile)"]
        Admin["Administrator / Staff"]
    end

    subgraph VPC["Custom Amazon VPC (10.0.0.0/16) - eu-north-1"]
        IGW["Internet Gateway"]
        
        subgraph PublicSubnet["Public Subnet (10.0.1.0/24 - eu-north-1a)"]
            EC2["Amazon EC2: SmartServe-Server (t3.micro)\n• React Production Build\n• Express.js REST API Server\n• Local AI / NLP Engine\n• CloudWatch Agent"]
        end

        subgraph PrivateSubnets["Private Subnets (10.0.10.0/24 & 10.0.11.0/24)"]
            RDS[("Amazon RDS MySQL 8.0\n• Port 3306 restricted to EC2 SG\n• Non-publicly accessible")]
        end
    end

    subgraph AWS_Services["AWS Managed Services"]
        SSM["AWS SSM Parameter Store\n(/smartserve/*)"]
        S3["Amazon S3 Bucket\n(Complaint Attachments)"]
        SQS["Amazon SQS Queue\n(smartserve-complaint-queue)"]
        SNS["Amazon SNS Topic\n(Resolution & Safety Alerts)"]
        CW["Amazon CloudWatch\n(Logs & CPU Alarm)"]
        Budget["AWS Budgets\n($5.00 Monthly Alert)"]
    end

    Users -->|HTTPS / HTTP Port 80| IGW
    IGW --> PublicSubnet
    EC2 -->|SQL Queries (Port 3306)| RDS
    EC2 -.->|Fetch Credentials (IAM Role)| SSM
    EC2 -.->|Upload Photo / Generate Presigned URL| S3
    EC2 -.->|Enqueue Complaint Event| SQS
    EC2 -.->|Publish Notification| SNS
    EC2 -.->|Log Ingestion & Metric Push| CW
```

> **Editable Architecture File**: The complete diagram XML is available at [`docs/smartserve-architecture.drawio`](docs/smartserve-architecture.drawio), viewable and editable on [draw.io](https://app.diagrams.net/).

---

## 7. Project Directory Structure

```text
SmartServe-AI/
├── backend/
│   ├── src/
│   │   ├── config/             # AWS clients, SSM parameter loader, MySQL pool
│   │   ├── controllers/        # Auth, Complaint, Admin, Analytics logic
│   │   ├── middleware/         # JWT auth, RBAC guards, Multer buffer filter
│   │   ├── models/             # schema.sql, seed.js, initDb.js
│   │   ├── routes/             # Express API routes
│   │   ├── services/           # Local AI engine, S3 presigned URLs, SQS, SNS, CloudWatch
│   │   └── server.js           # Express application entry point
│   ├── .env.example            # Configuration template (placeholders only)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/         # Navbar, StatusBadge, Modals
│   │   ├── context/            # AuthContext (JWT session state)
│   │   ├── pages/              # StudentDashboard, NewComplaintPage, AdminDashboard, AnalyticsPage
│   │   ├── services/           # Axios / Fetch API client
│   │   ├── App.jsx
│   │   ├── index.css           # Modern accessible stylesheet
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── docs/
│   ├── PROJECT_REPORT.md        # Academic report with methodology & cost breakdown
│   ├── VIVA_DEMO_SCRIPT.md      # Step-by-step 5-minute presentation script
│   ├── SCREENSHOT_CHECKLIST.md  # Evaluation screenshot checklist
│   └── smartserve-architecture.drawio # Source diagram file
├── scripts/
│   ├── deploy_infra.py         # Automated VPC, RDS, S3, IAM, SQS, SNS provisioning
│   ├── deploy_ec2.py           # Application packager, EC2 launcher, and service setup
│   └── cleanup_infra.py        # Automated teardown script for cost control
├── tests/
│   ├── integration_test.py     # 12-step end-to-end cloud verification suite
│   ├── test_staff_dashboard.py # Staff RBAC, ticket assignment, and isolation test
│   └── test_export.py          # CSV report authentication and download test
├── infra_inventory.example.json# Template for provisioned infrastructure metadata
├── .gitignore                  # Exclusion rules for secrets, keys, and build output
└── README.md
```

---

## 8. Prerequisites & Local Setup

### Prerequisites
- **Node.js** >= 18.x and **npm** >= 9.x
- **Python** 3.9+ (for deployment scripts and integration tests)
- **AWS CLI v2** configured with appropriate permissions (if deploying to AWS)
- **MySQL Server** 8.0+ (optional for standalone local development)

### Clone Repository
```bash
git clone https://github.com/doris2106/SmartServe-AI.git
cd SmartServe-AI
```

---

## 9. Environment Configuration

### Backend Configuration
Copy the template file to `.env` in the `backend/` directory:
```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your values (for local development without AWS SSM):
```ini
PORT=5000
NODE_ENV=development
AWS_REGION=eu-north-1

# Local Database Configuration (If running without AWS SSM)
DB_HOST=localhost
DB_PORT=3306
DB_NAME=smartserve_db
DB_USER=root
DB_PASSWORD=your_local_password

# JWT Secret
JWT_SECRET=your_super_secret_jwt_key_here

# AWS Services (Optional for local offline testing)
S3_BUCKET=your-attachments-bucket
SQS_QUEUE_URL=https://sqs.eu-north-1.amazonaws.com/123456789012/smartserve-complaint-queue
SNS_TOPIC_ARN=arn:aws:sns:eu-north-1:123456789012:smartserve-notifications-topic
```

> **In Production on AWS EC2**: The backend automatically retrieves database credentials, JWT secret, and AWS identifiers from **AWS Systems Manager Parameter Store** (`/smartserve/*`) via its IAM role. No local `.env` file is required on the server.

---

## 10. Database Schema & Initialization

The database schema is defined in [`backend/src/models/schema.sql`](backend/src/models/schema.sql).

### Tables Created:
1. `departments`: Academic & operational departments (Electrical, IT, Plumbing, Housekeeping, Civil).
2. `categories`: Complaint classifications with SLA priorities and default routing.
3. `users`: Students, staff, and administrators with role-based access.
4. `complaints`: Core ticket entity storing location, priority, status, S3 attachment keys, and AI urgency scores.
5. `complaint_updates`: Full audit history tracking lifecycle transitions and technician remarks.
6. `notifications`: In-app alert history for ticket progress.

### Initializing the Database
To create tables and seed default demo accounts:
```bash
cd backend
node -e "const { initDatabase } = require('./src/models/initDb'); initDatabase();"
```

---

## 11. Running Frontend & Backend

### 1. Start Backend API Server
```bash
cd backend
npm install
npm run dev
# Server starts on http://localhost:5000
```

### 2. Start Frontend Development Server
```bash
cd frontend
npm install
npm run dev
# Vite dev server starts on http://localhost:5173
```

---

## 12. AWS Deployment Guide (eu-north-1)

SmartServe AI includes automated Python deployment scripts using the AWS CLI:

### Step 1: Provision Infrastructure
Creates VPC, subnets, route tables, Internet Gateway, RDS MySQL instance, S3 bucket, SQS queue, SNS topic, SSM parameters, and IAM instance role:
```bash
python scripts/deploy_infra.py
```

### Step 2: Build & Deploy to EC2
Compiles the React frontend, packages the application tarball, uploads it to S3, and provisions an Amazon Linux 2023 EC2 instance with an automated user data script:
```bash
python scripts/deploy_ec2.py
```

The user data script installs Node.js 18, pulls the deployment package from S3, configures environment variables from SSM, creates a `systemd` service (`smartserve.service`), and starts the server.

---

## 13. Security & Least-Privilege IAM

- **Zero Hardcoded Secrets**: No AWS access keys, secret keys, or database passwords exist in source code. Credentials are loaded from SSM Parameter Store via IAM role.
- **Network Isolation**: RDS MySQL resides in private subnets with no public IP address. Inbound port 3306 is strictly restricted to the EC2 security group ID.
- **S3 Security**: Public access is completely blocked (`BlockPublicAcls`, `BlockPublicPolicy`). Attachments are accessed exclusively via temporary SigV4 presigned URLs valid for 15 minutes.
- **Server-Side Authorization**: Multi-role RBAC guards (`student`, `staff`, `admin`) are enforced on every Express route. Students cannot query admin APIs or view other students' tickets.
- **Audit Logging**: Every state change, assignment, and technician remark is captured in `complaint_updates` and streamed to CloudWatch Logs.

---

## 14. Testing & Verification

SmartServe AI comes with a 12-step automated verification suite:

```bash
# Run against local server:
python tests/integration_test.py http://localhost:5000

# Run against deployed EC2 instance:
python tests/integration_test.py http://<YOUR_EC2_PUBLIC_IP>
```

### Verification Checklist:
- [x] **Test 1**: Health Check endpoint returns HTTP 200 `HEALTHY`.
- [x] **Test 2**: Student authentication & JWT verification.
- [x] **Test 3**: Administrator authentication.
- [x] **Test 4**: Server-side RBAC guard denies students access to admin API (HTTP 403).
- [x] **Test 5**: Real-time AI NLP engine assigns accurate category, critical priority, and urgency score.
- [x] **Test 6**: AI duplicate detection identifies similar tickets (Sørensen-Dice token similarity).
- [x] **Test 7**: Complaint submission with image attachment uploaded to Amazon S3 and enqueued to SQS.
- [x] **Test 8**: S3 presigned URL generation and access.
- [x] **Test 9**: Cross-tenant student data isolation.
- [x] **Test 10**: Maintenance technician ticket assignment.
- [x] **Test 11**: Ticket resolution and Amazon SNS alert broadcast.
- [x] **Test 12**: Campus analytics and building hotspot aggregation.

---

## 15. Cost Management & Resource Cleanup

SmartServe AI is engineered to operate strictly within the **AWS Free Tier**:
- **EC2**: `t3.micro` instance (750 hours/month Free Tier).
- **RDS**: Single-AZ `db.t3.micro` (750 hours/month Free Tier).
- **S3**: Standard storage (< 5 GB Free Tier).
- **AWS Budgets**: Automated alarm triggers if monthly forecast exceeds \$5.00.

### Clean Up Resources
To prevent unwanted AWS charges after college evaluation:
```bash
python scripts/cleanup_infra.py
```
This script terminates the EC2 instance, deletes the RDS database, purges S3 bucket objects, removes the SQS queue, SNS topic, CloudWatch alarm, and deregisters IAM roles.

---

## 16. Author & Academic Information

- **Project**: Cloud Computing Engineering Mini-Project
- **Developer**: Doris Alphonso
- **GitHub**: [@doris2106](https://github.com/doris2106)
- **AWS Region**: `eu-north-1` (Stockholm)
