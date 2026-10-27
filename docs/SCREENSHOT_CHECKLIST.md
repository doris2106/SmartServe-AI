# SmartServe AI: Required Screenshots & Evaluation Evidence Checklist

Use this checklist to take screenshots for your college project report submission.

---

### Category A: AWS Management Console Evidence

- [ ] **Screenshot A1: Amazon EC2 Instances**
  - **AWS Console Path**: EC2 > Instances
  - **Target**: Show instance `SmartServe-Server` (`i-0e5b000964bc4ddc9`) with State `Running`, Public IPv4 `51.21.150.255`, and IAM Role `SmartServe-EC2-Role`.
  - **Report Caption**: *Figure 1: Amazon EC2 instance hosting SmartServe AI frontend and backend in custom VPC public subnet.*

- [ ] **Screenshot A2: Custom VPC & Subnets**
  - **AWS Console Path**: VPC > Your VPCs & Subnets
  - **Target**: Show `SmartServe-VPC` (`vpc-0a16761b4d6d1b1ee`, `10.0.0.0/16`) and the 4 subnets (`SmartServe-Pub-1a`, `SmartServe-Pub-1b`, `SmartServe-Pvt-1a`, `SmartServe-Pvt-1b`).
  - **Report Caption**: *Figure 2: Custom multi-tier VPC layout showing public web subnets and isolated private database subnets.*

- [ ] **Screenshot A3: Amazon RDS MySQL Database**
  - **AWS Console Path**: RDS > Databases
  - **Target**: Show DB identifier `smartserve-db` with Status `Available`, Engine `MySQL Community 8.0`, DB Subnet Group `smartserve-db-subnet-group`, and `Publicly accessible: No`.
  - **Report Caption**: *Figure 3: Managed Amazon RDS MySQL instance deployed across private subnets.*

- [ ] **Screenshot A4: Security Group Ingress Rules**
  - **AWS Console Path**: EC2 > Security Groups
  - **Target**: Show `smartserve-rds-sg` with Inbound Rule on Port 3306 restricted strictly to Source Security Group `smartserve-ec2-sg`.
  - **Report Caption**: *Figure 4: RDS Security Group enforcing least privilege by permitting port 3306 strictly from the EC2 security group.*

- [ ] **Screenshot A5: Amazon S3 Bucket & CORS**
  - **AWS Console Path**: S3 > Buckets
  - **Target**: Show bucket `smartserve-attachments-548931595895` with `Bucket and objects not public` and uploaded complaint attachments in `/complaints/`.
  - **Report Caption**: *Figure 5: Private S3 bucket for storing complaint attachments securely.*

- [ ] **Screenshot A6: AWS Systems Manager Parameter Store**
  - **AWS Console Path**: Systems Manager > Parameter Store
  - **Target**: Show parameters under `/smartserve/*` (`/db/host`, `/db/password`, `/jwt/secret`, etc.).
  - **Report Caption**: *Figure 6: Secure configuration and credential parameters stored in AWS SSM Parameter Store.*

- [ ] **Screenshot A7: Amazon SQS Queue & Amazon SNS Topic**
  - **AWS Console Path**: SQS > Queues & SNS > Topics
  - **Target**: Show queue `smartserve-complaint-queue` and topic `smartserve-notifications-topic`.
  - **Report Caption**: *Figure 7: Asynchronous event pipeline utilizing Amazon SQS and Amazon SNS.*

- [ ] **Screenshot A8: Amazon CloudWatch Logs & Alarm**
  - **AWS Console Path**: CloudWatch > Log groups & Alarms
  - **Target**: Show Log Group `/smartserve/app` with log stream `api-server-*` and Metric Alarm `SmartServe-EC2-HighCPU-Alarm` in `OK` status.
  - **Report Caption**: *Figure 8: CloudWatch application log streaming and EC2 CPU threshold monitoring alarm.*

- [ ] **Screenshot A9: AWS Budget & Cost Alert**
  - **AWS Console Path**: Billing and Cost Management > Budgets
  - **Target**: Show `SmartServe-Monthly-Budget` ($5.00 limit with 80% threshold).
  - **Report Caption**: *Figure 9: AWS Budget cost-control configuration.*

---

### Category B: Live Application Web Portal Evidence

- [ ] **Screenshot B1: Student Dashboard & Submitted Tickets**
  - **URL**: `http://51.21.150.255` (Logged in as Doris Alphonso)
  - **Target**: Student dashboard showing metrics cards, search filter, and list of complaints with status badges.
  - **Report Caption**: *Figure 10: SmartServe AI student dashboard showing ticket overview and tracking.*

- [ ] **Screenshot B2: Live AI Assistant During Complaint Lodging**
  - **URL**: `http://51.21.150.255` (Lodge Complaint form)
  - **Target**: Show complaint form with text entered and the **SmartServe AI Assistant** card dynamically highlighting suggested category, urgency score (e.g. 10/10), and duplicate detection warning.
  - **Report Caption**: *Figure 11: Real-time AI Assistant classifying category and calculating urgency score.*

- [ ] **Screenshot B3: S3 Presigned Attachment Access**
  - **URL**: `http://51.21.150.255` (Ticket Details modal)
  - **Target**: Show complaint details modal displaying S3 attachment file and presigned URL button.
  - **Report Caption**: *Figure 12: Private S3 complaint attachment viewed via secure time-limited presigned URL.*

- [ ] **Screenshot B4: Administrator Command Center**
  - **URL**: `http://51.21.150.255` (Logged in as Campus Administrator)
  - **Target**: Admin dashboard with campus tickets, staff assignment, and status controls.
  - **Report Caption**: *Figure 13: Administrator dashboard for campus maintenance ticket assignment.*

- [ ] **Screenshot B5: Interactive Campus Analytics & Charts**
  - **URL**: `http://51.21.150.255` (Campus Analytics tab)
  - **Target**: Interactive Doughnut chart (categories), Bar chart (building hotspots), and department performance table.
  - **Report Caption**: *Figure 14: Campus operations analytics powered by Chart.js and Amazon RDS.*

