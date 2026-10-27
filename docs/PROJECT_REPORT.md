# SmartServe AI: Intelligent Campus Service and Resource Management System
## Cloud Computing Engineering Mini-Project Report & Comprehensive Documentation

---

### Executive Summary

**SmartServe AI** is a production-grade, cloud-native campus service and facility management portal built to automate, prioritize, and streamline campus infrastructure complaints (e.g. electrical breakdowns, Wi-Fi connectivity, plumbing leaks, laboratory equipment faults, and classroom projector failures). 

The system is deployed on **Amazon Web Services (AWS Region: `eu-north-1`)** and satisfies every core requirement of Compute, Networking, Database, Storage, Security/IAM, Messaging, AI Engineering, and Cost Monitoring.

- **Verified Application URL**: `http://51.21.150.255`
- **Health Check Endpoint**: `http://51.21.150.255/api/health`
- **Target AWS Region**: `eu-north-1` (Europe/Stockholm)
- **AWS Account ID**: `548931595895`

---

## 1. Cloud Architecture & Service Justification Matrix

| AWS Service | Resource Identifier / Name | Role & Architecture Purpose | Integration Mechanism | Free Tier / Cost Profile |
| :--- | :--- | :--- | :--- | :--- |
| **Amazon EC2** | `SmartServe-Server`<br>(`i-0e5b000964bc4ddc9`) | Hosts production React SPA and Node.js Express REST API under systemd on port 80. | Deployed in custom public subnet with Elastic Network Interface (`51.21.150.255`). | Free Tier eligible (`t3.micro`, 750 hrs/month). |
| **Amazon VPC** | `SmartServe-VPC`<br>(`vpc-0a16761b4d6d1b1ee`) | Isolates campus infrastructure network (`10.0.0.0/16`) into public and private tiers. | Internet Gateway attached for public ingress; dedicated route tables. | No charge for VPC, IGW, or route tables. |
| **Amazon RDS** | `smartserve-db`<br>(MySQL 8.0, `db.t3.micro`) | Managed transactional database storing users, complaints, departments, and audit logs. | Placed in private DB subnet group (`10.0.10.0/24`, `10.0.11.0/24`); port 3306 restricted to EC2 SG. | Free Tier eligible (750 hrs/month `db.t3.micro` + 20 GB gp3). |
| **Amazon S3** | `smartserve-attachments-548931595895` | Private object storage for complaint photographs and supporting documents. | Uploaded via streaming buffer; viewed using time-limited AWS SigV4 Presigned URLs. | Free Tier (5 GB standard storage, 20,000 GET requests). |
| **AWS Systems Manager** | `/smartserve/*`<br>(9 parameters) | Centralized, secure storage of configuration parameters, DB credentials, and JWT secret. | Express loads configurations on boot using AWS SDK v3 `GetParametersByPathCommand`. | Standard Parameter Store calls are free of charge. |
| **AWS IAM** | `SmartServe-EC2-Role`<br>& Instance Profile | Least-privilege IAM credentials for EC2 compute instance. | Attached directly to EC2; code never hard-codes Access Keys or Secrets. | IAM is free of charge. |
| **Amazon SQS** *(Addl. Capability 1)* | `smartserve-complaint-queue` | Decouples complaint registration from backend processing and audit pipeline. | Express dispatches new ticket payloads asynchronously to SQS via `@aws-sdk/client-sqs`. | Free Tier (1,000,000 SQS requests/month free). |
| **Amazon SNS** *(Addl. Capability 2)* | `smartserve-notifications-topic` | Publishes high-urgency alerts for 'Critical' electrical/safety incidents and ticket resolutions. | Triggered by controller when priority is Critical or status becomes Resolved. | Free Tier (1,000,000 publishes free/month). |
| **Amazon CloudWatch** | Log Group: `/smartserve/app`<br>Alarm: `SmartServe-EC2-HighCPU-Alarm` | Operational telemetry: real-time application logs, CPU utilization alarm, custom metrics. | SDK streams application events; CloudWatch evaluates EC2 CPU > 80% and triggers SNS. | Free Tier (5 GB log ingestion, 10 custom metrics/alarms free). |
| **AWS Budgets** | `SmartServe-Monthly-Budget` | Financial governance: monitors account spending and notifies when budget reaches 80% of $5.00 limit. | Global AWS Budgets engine sending alerts to `dorisalphonso21@gmail.com`. | 2 free budgets per account. |

---

## 2. Networking & Security Architecture

### 2.1 Multi-Tier Custom VPC Subnet Layout
- **VPC CIDR**: `10.0.0.0/16` (`SmartServe-VPC`)
- **Public Subnet 1a** (`10.0.1.0/24`, AZ `eu-north-1a`): Houses EC2 application instance (`SmartServe-Server`).
- **Public Subnet 1b** (`10.0.2.0/24`, AZ `eu-north-1b`): High-availability standby public tier.
- **Private Subnet 1a** (`10.0.10.0/24`, AZ `eu-north-1a`): Primary RDS DB subnet.
- **Private Subnet 1b** (`10.0.11.0/24`, AZ `eu-north-1b`): Secondary RDS DB subnet (fulfills RDS Multi-AZ subnet requirement).

### 2.2 Security Group Rules (Least Privilege)
1. **`smartserve-ec2-sg` (`sg-0c60202496ace57da`)**:
   - Inbound HTTP (Port 80): `0.0.0.0/0` (Web browser access)
   - Inbound Dev (Port 5000): `0.0.0.0/0`
   - Inbound SSH (Port 22): Authorized IP / Key pair (`smartserve-key.pem`)
   - Outbound: `0.0.0.0/0` (Direct internet access via Internet Gateway without costly NAT Gateway)
2. **`smartserve-rds-sg` (`sg-07d1ceaa932521ee7`)**:
   - Inbound MySQL (Port 3306): **Strictly restricted to Source Security Group `sg-0c60202496ace57da`**.
   - **Zero public access**: RDS is in private subnets with `PubliclyAccessible: false`. No external internet traffic can reach the database.

---

## 3. Intelligent AI Engine Implementation

### 3.1 Transparent Local Classifier
SmartServe AI incorporates an explainable, lightweight natural language processing (NLP) engine designed to run locally in the Express backend without incurring expensive third-party AI API charges.

1. **TF-IDF Category Vector Model**:
   - Pre-compiled weighted vocabulary across 7 facility domains (Wi-Fi, AV/Projectors, Electrical, Plumbing, Lab Equipment, Housekeeping, Furniture).
   - Computes normalized term frequencies and produces a confidence rating ($0.60$ to $0.99$).
2. **Safety & Disruption Urgency Heuristic**:
   - Evaluates emergency keywords (`spark`, `shock`, `fire`, `smoke`, `short circuit`, `flood`, `exam`, `leakage`).
   - Generates an **Urgency Score** ($1.0$ to $10.0$ scale):
     - $\ge 9.0$: **Critical** (Triggers immediate Amazon SNS broadcast)
     - $7.0 - 8.9$: **High**
     - $4.0 - 6.9$: **Medium**
     - $< 4.0$: **Low**
3. **Duplicate & Similarity Detection (Sørensen–Dice Coefficient)**:
   - Formulates word tokens from the incoming ticket and compares against recent active complaints in the same building:
     $$\text{Similarity}(A, B) = \frac{2 \times |A \cap B|}{|A| + |B|}$$
   - When similarity $\ge 35\%$ in the same building, the engine flags a duplicate warning to the student in real-time, preventing redundant maintenance dispatches.

---

## 4. Test & Verification Results

All 12 automated end-to-end integration tests passed with 100% success against the live EC2 server:

```text
==================================================
  SMARTSERVE AI - TEST EXECUTION RESULTS
==================================================
  [PASS] Health Check Endpoint               | Status: 200, Health: HEALTHY
  [PASS] Student Authentication              | Status: 200, User: Doris Alphonso
  [PASS] Admin Authentication                | Status: 200, Role: admin
  [PASS] RBAC Authorization Guard            | Expected 403 Forbidden, got 403
  [PASS] AI Urgency & Category Engine        | Category: Electricity & Lighting, Priority: Critical, Score: 10
  [PASS] AI Duplicate Detection              | Detected duplicate: SSC-2026-1001 (69% match)
  [PASS] Complaint Lodging (S3 + SQS)        | Ticket: SSC-2026-1006, ID: 6
  [PASS] S3 Presigned Attachment Access      | Presigned URL successfully created with AWS V4 signature
  [PASS] Student Data Privacy Isolation      | Cross-tenant access prevented with 403 Forbidden
  [PASS] Admin Ticket Assignment             | Status: 200, Message: Ticket SSC-2026-1006 assigned to staff.
  [PASS] Ticket Resolution (SNS Dispatch)    | Status: 200, Ticket marked Resolved
  [PASS] Campus Analytics & Hotspots         | Total Complaints: 6, Hotspots: 3

Final Score: 12 / 12 Passed (100% Success Rate)
```

---

## 5. Cost Analysis & Financial Governance

| Service Tier | Usage Profile | Monthly Rate | Demonstration Period (7 Days) |
| :--- | :--- | :--- | :--- |
| **Amazon EC2 (t3.micro)** | 1 instance running 24/7 | $0.00 (Free Tier) / ~$7.45 | ~$1.80 |
| **Amazon RDS (db.t3.micro)** | Single-AZ MySQL 8.0, 20GB gp3 | $0.00 (Free Tier) / ~$14.60 | ~$3.65 |
| **Amazon S3** | Standard storage (< 100 MB), < 1,000 requests | $0.00 (Free Tier) | < $0.01 |
| **Amazon SQS & SNS** | < 1,000 messages and publishes | $0.00 (Free Tier) | $0.00 |
| **CloudWatch & SSM** | 1 log group, 1 metric alarm, 9 standard parameters | $0.00 (Free Tier) | $0.00 |
| **Total Estimated Cost** | Fully within AWS Free Tier | **$0.00 - $0.50** | **~$0.10** |

- **Cost Protection**: Configured **AWS Budget** (`SmartServe-Monthly-Budget`) alerting at **80% of $5.00/month**.
- **Architectural Cost Optimization**: Avoided expensive NAT Gateways (~$32.40/month savings) and Multi-AZ replication while maintaining strict security via private subnets.

---

## 6. Safe Shutdown & Resource Cleanup Guide

When the college evaluation is fully concluded, run the automated cleanup script:
```powershell
python c:\Users\Doris\CCL\smartserve-ai\scripts\cleanup_infra.py
```
This gracefully terminates:
1. EC2 Instance (`SmartServe-Server`)
2. CloudWatch Alarm (`SmartServe-EC2-HighCPU-Alarm`)
3. SQS Queue & SNS Topic
4. RDS MySQL Database (`smartserve-db`) with automated backups purged
5. S3 Bucket attachments emptied and removed
6. Security Groups, Subnets, Internet Gateway, and Custom VPC

