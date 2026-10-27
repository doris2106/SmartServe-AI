# SmartServe AI: College Viva & Faculty Demonstration Script

This step-by-step presentation script is tailored for a 5-minute college viva evaluation.

---

## 1. Five-Minute Live Demonstration Walkthrough

### Step 1: Open the Application & Show Cloud Deployment (Minute 1)
1. Open Google Chrome on your computer.
2. Navigate to the verified EC2 URL: **`http://51.21.150.255`**
3. **Say to Faculty**:
   > *"Good morning professors. SmartServe AI is an intelligent campus service and resource management system deployed entirely on Amazon Web Services in Region eu-north-1. The frontend is built with React and Vite, running alongside an Express REST API on Amazon EC2 within a custom VPC. All transactional data is securely stored in Amazon RDS MySQL in isolated private subnets."*

### Step 2: Student Module & Real-time AI Assistant (Minute 2)
1. Click **Sign In**. Click the demo shortcut: **`Doris Alphonso (Student)`**. Click **Sign In**.
2. Point out the student dashboard showing metrics: Total complaints, In Progress, Resolved.
3. Click **Lodge Complaint** to open the complaint submission form.
4. Type in the title:
   ```text
   Severe sparking from switchboard in Computer Lab 3
   ```
5. **Point to the screen**: Show the **SmartServe AI Assistant** card dynamically updating!
   - Notice: **Suggested Category** automatically becomes **`Electricity & Lighting`** (with confidence score).
   - Notice: **Calculated Urgency** automatically becomes **`Critical (Score: 10/10)`**.
6. Type in description:
   ```text
   Smoke and sparks observed when turning on the AC unit, creating fire hazard.
   ```
7. Attach any picture (photo of broken switch or water cooler).
8. Click **Submit Complaint**.
9. **Say to Faculty**:
   > *"When the student submits this ticket, several AWS services execute in unison:
   > 1. The image is securely streamed into Amazon S3 with public access completely blocked.
   > 2. The ticket is registered in Amazon RDS MySQL using parameterized SQL queries.
   > 3. An asynchronous event is dispatched to Amazon SQS for background decoupling.
   > 4. Because the AI classified this as 'Critical', an immediate incident notification was published via Amazon SNS.
   > 5. An event was logged to Amazon CloudWatch Logs."*

### Step 3: Student Data Privacy & S3 Presigned URL (Minute 3)
1. In the student dashboard, click **View** on the newly created complaint.
2. Show the **Open Presigned S3 Link** button. Click it.
3. Point out the URL: Notice `https://smartserve-attachments-548931595895.s3.eu-north-1.amazonaws.com/...` with `X-Amz-Signature`.
4. **Say to Faculty**:
   > *"Our S3 bucket is completely private. Access to attachments is granted only through short-lived presigned URLs generated server-side. Additionally, our API enforces strict tenant isolation: students can only query their own complaints, and unauthorized access attempts return HTTP 403 Forbidden."*

### Step 4: Administrator Command Center & Staff Assignment (Minute 4)
1. Click **Logout** at the top right.
2. Click **Sign In** -> select **`Campus Administrator (Admin)`** -> Click **Sign In**.
3. Now show the **Admin Command Center**:
   - Point out the complaints table showing all campus tickets.
   - Click **Assign** on the newly created complaint -> Select **`Sunil Pawar (Electrician)`** -> Add remarks: *"Attend immediately"* -> Click **Confirm Assignment**.
   - Click **Status** -> Change status to **`Resolved`** -> Enter resolution remarks -> Click **Update Ticket**.
4. Show the **Export CSV Report** button: Click it to download a live spreadsheet of all campus complaints.

### Step 5: Campus Analytics & Cloud Telemetry (Minute 5)
1. Click the **Campus Analytics** tab in the top navigation.
2. Showcase the interactive Chart.js visualizations:
   - **Issue Distribution by Category** (Doughnut chart)
   - **Campus Building Hotspots** (Bar chart showing safety risk per building)
   - **Department Operational Performance** (Resolution percentage rates)
3. Conclude by opening the AWS Console (or CloudWatch logs):
   - Show CloudWatch Log Group: **`/smartserve/app`** (showing live user logins and ticket logs).
   - Show CloudWatch Alarm: **`SmartServe-EC2-HighCPU-Alarm`**.
   - Show AWS Budget: **`SmartServe-Monthly-Budget`** ($5.00 limit).

---

## 2. Frequently Asked Viva Questions & Answers

### Q1: Why did you place Amazon RDS in private subnets instead of public subnets?
**Answer**:
> *"Placing RDS in private subnets ensures defense-in-depth security. Our database has no public IP address and cannot be accessed from the internet. Furthermore, its security group permits incoming traffic on port 3306 strictly from the EC2 application security group, completely preventing unauthorized external access or brute-force SQL attacks."*

### Q2: How did you avoid hard-coding AWS credentials in your source code?
**Answer**:
> *"We attached an IAM Role (`SmartServe-EC2-Role`) and Instance Profile to our EC2 instance. The AWS SDK v3 automatically assumes these temporary credentials using the EC2 instance metadata service. All secrets, including the database password and JWT secret, are fetched dynamically on startup from AWS Systems Manager Parameter Store under `/smartserve/*`."*

### Q3: How does your AI engine work? Is it calling a paid API like OpenAI?
**Answer**:
> *"No, we purposely built an explainable, lightweight NLP classifier that runs locally inside our Node.js runtime. It utilizes a TF-IDF weighted vector model for category classification, an emergency indicator heuristic for urgency scoring (1 to 10 scale), and the Sørensen-Dice coefficient for duplicate detection. This avoids expensive API bills and latency while maintaining 100% availability even during network disruptions."*

### Q4: Why did you use both Amazon SQS and Amazon SNS?
**Answer**:
> *"SQS and SNS serve distinct architectural purposes in our event-driven design:
> - **Amazon SQS** provides a point-to-point, asynchronous message queue that decouples complaint ingestion from background processing, preventing database load spikes.
> - **Amazon SNS** is a publish-subscribe broadcast topic used for urgent alerts (such as critical electrical shocks or fire hazards) and instant resolution broadcasts."*

### Q5: How do you prevent unexpected AWS billing?
**Answer**:
> *"We adhered strictly to Free Tier eligible configurations (t3.micro EC2, db.t3.micro RDS Single-AZ, 20GB gp3 storage). We avoided costly NAT Gateways (~$32/mo) by routing outbound traffic through the Internet Gateway with tight security groups. Finally, we configured an active AWS Budget ($5.00 threshold) with automated email alerts."*

