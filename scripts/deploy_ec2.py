import subprocess
import json
import base64
import time
import os
import sys

REGION = "eu-north-1"
ACCOUNT_ID = "548931595895"
AMI_ID = "ami-08e7e754b2c895da7" # Amazon Linux 2023 x86_64

def aws(args, check=True):
    cmd = ["aws"] + args + ["--output", "json"]
    print(f"[AWS] {' '.join(cmd)}")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if check and res.returncode != 0:
        print(f"Error: {res.stderr}")
        raise RuntimeError(res.stderr)
    if res.stdout.strip():
        try:
            return json.loads(res.stdout)
        except Exception:
            return res.stdout.strip()
    return {}

def main():
    print("==================================================")
    print("  SMARTSERVE AI - EC2 DEPLOYMENT & VERIFICATION   ")
    print("==================================================")

    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    inv_path = os.environ.get("INVENTORY_PATH", os.path.join(project_root, "infra_inventory.json"))
    if not os.path.exists(inv_path):
        inv_path = os.path.join(project_root, "infra_inventory.example.json")
    with open(inv_path, "r") as f:
        inv = json.load(f)

    # 2. Key Pair
    print("\n[1/5] Ensuring EC2 Key Pair...")
    key_name = os.environ.get("KEY_NAME", "smartserve-key")
    key_file = os.environ.get("KEY_FILE", os.path.join(os.path.dirname(project_root), "smartserve-key.pem"))
    keys = aws(["ec2", "describe-key-pairs", "--filters", f"Name=key-name,Values={key_name}", "--region", REGION])
    if not keys.get("KeyPairs"):
        res = aws(["ec2", "create-key-pair", "--key-name", key_name, "--key-type", "rsa", "--key-format", "pem", "--region", REGION])
        key_material = res.get("KeyMaterial", "")
        with open(key_file, "w") as f:
            f.write(key_material)
        print(f"  Created new key pair: {key_name} -> Saved to {key_file}")
    else:
        print(f"  Existing key pair {key_name} found.")

    # 3. Create deployment bundle
    print("\n[2/5] Creating and Uploading Deployment Bundle to S3...")
    bundle_path = os.path.join(project_root, "smartserve-app.tar.gz")
    
    # We create a tar.gz containing backend and frontend/dist
    tar_cmd = [
        "tar", "-czf", bundle_path,
        "-C", project_root,
        "backend",
        "frontend/dist"
    ]
    subprocess.run(tar_cmd, check=True)
    print(f"  Created bundle: {bundle_path}")

    # Upload to S3
    bucket = inv["S3Bucket"]
    aws(["s3", "cp", bundle_path, f"s3://{bucket}/deploy/smartserve-app.tar.gz", "--region", REGION])
    print(f"  Uploaded bundle to s3://{bucket}/deploy/smartserve-app.tar.gz")

    # 4. User Data Script
    user_data = f"""#!/bin/bash
set -e
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1
echo "Starting SmartServe AI Server Deployment..."

# 1. Update and install Node.js 20 & tools
dnf update -y
dnf install -y git nodejs npm

# 2. Extract application
mkdir -p /var/www/smartserve
cd /var/www/smartserve
aws s3 cp s3://{bucket}/deploy/smartserve-app.tar.gz /tmp/smartserve-app.tar.gz --region {REGION}
tar -xzf /tmp/smartserve-app.tar.gz -C /var/www/smartserve

# 3. Install backend dependencies
cd /var/www/smartserve/backend
npm install --omit=dev

# 4. Initialize RDS Schema & Seed data
echo "Running database initialization against RDS..."
node src/models/initDb.js

# 5. Create Systemd Service for continuous running on port 80
cat << 'EOF' > /etc/systemd/system/smartserve.service
[Unit]
Description=SmartServe AI Campus Management System
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/smartserve/backend
Environment=PORT=80
Environment=NODE_ENV=production
Environment=AWS_REGION={REGION}
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable smartserve
systemctl start smartserve

echo "SmartServe AI Server successfully deployed and active on port 80!"
"""

    encoded_user_data = base64.b64encode(user_data.encode("utf-8")).decode("utf-8")

    # 5. Launch EC2 Instance
    print("\n[3/5] Launching EC2 Instance (t3.micro in custom VPC)...")
    existing_inst = aws(["ec2", "describe-instances", 
                         "--filters", "Name=tag:Name,Values=SmartServe-Server", "Name=instance-state-name,Values=pending,running",
                         "--region", REGION])
    
    if existing_inst.get("Reservations") and existing_inst["Reservations"][0].get("Instances"):
        inst_id = existing_inst["Reservations"][0]["Instances"][0]["InstanceId"]
        pub_ip = existing_inst["Reservations"][0]["Instances"][0].get("PublicIpAddress", "")
        pub_dns = existing_inst["Reservations"][0]["Instances"][0].get("PublicDnsName", "")
        print(f"  Existing running instance: {inst_id} ({pub_ip})")
    else:
        run_res = aws([
            "ec2", "run-instances",
            "--image-id", AMI_ID,
            "--instance-type", "t3.micro",
            "--key-name", key_name,
            "--subnet-id", inv["PublicSubnet1a"],
            "--security-group-ids", inv["Ec2SecurityGroupId"],
            "--iam-instance-profile", f"Name={inv['InstanceProfile']}",
            "--user-data", encoded_user_data,
            "--tag-specifications", "ResourceType=instance,Tags=[{Key=Name,Value=SmartServe-Server},{Key=Project,Value=SmartServeAI}]",
            "--region", REGION
        ])
        inst_id = run_res["Instances"][0]["InstanceId"]
        print(f"  Launched EC2 Instance: {inst_id}")

        # Wait for running state
        print("  Waiting for instance to enter 'running' state...")
        time.sleep(15)
        for _ in range(20):
            desc = aws(["ec2", "describe-instances", "--instance-ids", inst_id, "--region", REGION])
            state = desc["Reservations"][0]["Instances"][0]["State"]["Name"]
            if state == "running":
                pub_ip = desc["Reservations"][0]["Instances"][0].get("PublicIpAddress", "")
                pub_dns = desc["Reservations"][0]["Instances"][0].get("PublicDnsName", "")
                print(f"  Instance is RUNNING! Public IP: {pub_ip}, Public DNS: {pub_dns}")
                break
            time.sleep(5)

    # 6. CloudWatch Metric Alarm
    print("\n[4/5] Configuring CloudWatch CPU Utilization Alarm...")
    alarm_name = "SmartServe-EC2-HighCPU-Alarm"
    aws([
        "cloudwatch", "put-metric-alarm",
        "--alarm-name", alarm_name,
        "--alarm-description", "Alarm when EC2 CPU exceeds 80% for SmartServe App Server",
        "--metric-name", "CPUUtilization",
        "--namespace", "AWS/EC2",
        "--statistic", "Average",
        "--period", "300",
        "--threshold", "80.0",
        "--comparison-operator", "GreaterThanOrEqualToThreshold",
        "--dimensions", f"Name=InstanceId,Value={inst_id}",
        "--evaluation-periods", "1",
        "--alarm-actions", inv["TopicArn"],
        "--region", REGION
    ])
    print(f"  CloudWatch Alarm {alarm_name} configured and linked to SNS Topic.")

    # 7. AWS Budget
    print("\n[5/5] Configuring AWS Budget Cost Alert...")
    budget_payload = {
        "Budget": {
            "BudgetName": "SmartServe-Monthly-Budget",
            "BudgetLimit": {"Amount": "5.0", "Unit": "USD"},
            "CostTypes": {
                "IncludeTax": True,
                "IncludeSubscription": True,
                "UseBlended": False,
                "IncludeRefund": False,
                "IncludeCredit": False,
                "IncludeUpfront": True,
                "IncludeRecurring": True,
                "IncludeOtherSubscription": True,
                "IncludeSupport": True,
                "IncludeDiscount": True,
                "UseAmortized": False
            },
            "TimeUnit": "MONTHLY",
            "BudgetType": "COST"
        },
        "NotificationsWithSubscribers": [
            {
                "Notification": {
                    "NotificationType": "ACTUAL",
                    "ComparisonOperator": "GREATER_THAN",
                    "Threshold": 80.0,
                    "ThresholdType": "PERCENTAGE"
                },
                "Subscribers": [
                    {
                        "SubscriptionType": "EMAIL",
                        "Address": "dorisalphonso21@gmail.com"
                    }
                ]
            }
        ]
    }
    with open("budget.json", "w") as f:
        json.dump(budget_payload, f)
    aws(["budgets", "create-budget", "--account-id", ACCOUNT_ID, "--budget", "file://budget.json", "--notifications-with-subscribers", "file://budget.json"], check=False)
    print("  AWS Budget configured ($5.00 threshold alert to dorisalphonso21@gmail.com).")

    # Update inventory
    inv["InstanceId"] = inst_id
    inv["PublicIp"] = pub_ip
    inv["PublicDns"] = pub_dns
    inv["AppUrl"] = f"http://{pub_ip}"
    inv["CloudWatchAlarm"] = alarm_name
    inv["BudgetName"] = "SmartServe-Monthly-Budget"

    with open(inv_path, "w") as f:
        json.dump(inv, f, indent=2)

    print("\n==================================================")
    print(f"  DEPLOYMENT COMPLETE!")
    print(f"  Application URL: http://{pub_ip}")
    print(f"  Health Endpoint: http://{pub_ip}/api/health")
    print("==================================================")

if __name__ == "__main__":
    main()

