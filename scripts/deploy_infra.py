import os
import subprocess
import json
import time
import sys

REGION = os.environ.get("AWS_REGION", "eu-north-1")

def get_account_id():
    res = aws(["sts", "get-caller-identity"], check=False)
    if isinstance(res, dict) and "Account" in res:
        return res["Account"]
    return os.environ.get("AWS_ACCOUNT_ID", "548931595895")

ACCOUNT_ID = get_account_id()

def aws(args, check=True):
    cmd = ["aws"] + args + ["--output", "json"]
    print(f"[AWS] {' '.join(cmd)}")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if check and res.returncode != 0:
        print(f"Error executing: {' '.join(cmd)}\nSTDERR: {res.stderr}")
        raise RuntimeError(res.stderr)
    if res.stdout.strip():
        try:
            return json.loads(res.stdout)
        except Exception:
            return res.stdout.strip()
    return {}

def main():
    print("==================================================")
    print("  SMARTSERVE AI - CLOUD INFRASTRUCTURE DEPLOYMENT ")
    print(f"  Region: {REGION} | Account: {ACCOUNT_ID}")
    print("==================================================")

    # 1. VPC
    print("\n[1/10] Checking/Creating VPC...")
    vpcs = aws(["ec2", "describe-vpcs", "--filters", "Name=tag:Name,Values=SmartServe-VPC", "--region", REGION])
    if vpcs.get("Vpcs"):
        vpc_id = vpcs["Vpcs"][0]["VpcId"]
        print(f"  Existing SmartServe-VPC found: {vpc_id}")
    else:
        res = aws(["ec2", "create-vpc", "--cidr-block", "10.0.0.0/16", "--tag-specifications", "ResourceType=vpc,Tags=[{Key=Name,Value=SmartServe-VPC},{Key=Project,Value=SmartServeAI}]", "--region", REGION])
        vpc_id = res["Vpc"]["VpcId"]
        print(f"  Created VPC: {vpc_id}")
        aws(["ec2", "modify-vpc-attribute", "--vpc-id", vpc_id, "--enable-dns-hostnames", "{\"Value\":true}", "--region", REGION])
        aws(["ec2", "modify-vpc-attribute", "--vpc-id", vpc_id, "--enable-dns-support", "{\"Value\":true}", "--region", REGION])

    # 2. Subnets
    print("\n[2/10] Creating Subnets...")
    subnet_defs = [
        {"name": "SmartServe-Pub-1a", "cidr": "10.0.1.0/24", "az": "eu-north-1a", "public": True},
        {"name": "SmartServe-Pub-1b", "cidr": "10.0.2.0/24", "az": "eu-north-1b", "public": True},
        {"name": "SmartServe-Pvt-1a", "cidr": "10.0.10.0/24", "az": "eu-north-1a", "public": False},
        {"name": "SmartServe-Pvt-1b", "cidr": "10.0.11.0/24", "az": "eu-north-1b", "public": False},
    ]
    subnets = {}
    for s in subnet_defs:
        existing = aws(["ec2", "describe-subnets", "--filters", f"Name=tag:Name,Values={s['name']}", f"Name=vpc-id,Values={vpc_id}", "--region", REGION])
        if existing.get("Subnets"):
            sub_id = existing["Subnets"][0]["SubnetId"]
            print(f"  Existing subnet {s['name']}: {sub_id}")
        else:
            res = aws(["ec2", "create-subnet", "--vpc-id", vpc_id, "--cidr-block", s["cidr"], "--availability-zone", s["az"], "--tag-specifications", f"ResourceType=subnet,Tags=[{{Key=Name,Value={s['name']}}},{{Key=Project,Value=SmartServeAI}}]", "--region", REGION])
            sub_id = res["Subnet"]["SubnetId"]
            print(f"  Created subnet {s['name']}: {sub_id}")
            if s["public"]:
                aws(["ec2", "modify-subnet-attribute", "--subnet-id", sub_id, "--map-public-ip-on-launch", "--region", REGION])
        subnets[s["name"]] = sub_id

    # 3. Internet Gateway
    print("\n[3/10] Internet Gateway & Route Tables...")
    igws = aws(["ec2", "describe-internet-gateways", "--filters", "Name=tag:Name,Values=SmartServe-IGW", "--region", REGION])
    if igws.get("InternetGateways"):
        igw_id = igws["InternetGateways"][0]["InternetGatewayId"]
        print(f"  Existing IGW found: {igw_id}")
    else:
        res = aws(["ec2", "create-internet-gateway", "--tag-specifications", "ResourceType=internet-gateway,Tags=[{Key=Name,Value=SmartServe-IGW}]", "--region", REGION])
        igw_id = res["InternetGateway"]["InternetGatewayId"]
        aws(["ec2", "attach-internet-gateway", "--internet-gateway-id", igw_id, "--vpc-id", vpc_id, "--region", REGION])
        print(f"  Created and attached IGW: {igw_id}")

    # Public Route Table
    rtbs = aws(["ec2", "describe-route-tables", "--filters", "Name=tag:Name,Values=SmartServe-Pub-RT", f"Name=vpc-id,Values={vpc_id}", "--region", REGION])
    if rtbs.get("RouteTables"):
        pub_rtb_id = rtbs["RouteTables"][0]["RouteTableId"]
        print(f"  Existing Public RT found: {pub_rtb_id}")
    else:
        res = aws(["ec2", "create-route-table", "--vpc-id", vpc_id, "--tag-specifications", "ResourceType=route-table,Tags=[{Key=Name,Value=SmartServe-Pub-RT}]", "--region", REGION])
        pub_rtb_id = res["RouteTable"]["RouteTableId"]
        aws(["ec2", "create-route", "--route-table-id", pub_rtb_id, "--destination-cidr-block", "0.0.0.0/0", "--gateway-id", igw_id, "--region", REGION])
        aws(["ec2", "associate-route-table", "--route-table-id", pub_rtb_id, "--subnet-id", subnets["SmartServe-Pub-1a"], "--region", REGION])
        aws(["ec2", "associate-route-table", "--route-table-id", pub_rtb_id, "--subnet-id", subnets["SmartServe-Pub-1b"], "--region", REGION])
        print(f"  Created and associated Public RT: {pub_rtb_id}")

    # Private Route Table
    pvt_rtbs = aws(["ec2", "describe-route-tables", "--filters", "Name=tag:Name,Values=SmartServe-Pvt-RT", f"Name=vpc-id,Values={vpc_id}", "--region", REGION])
    if pvt_rtbs.get("RouteTables"):
        pvt_rtb_id = pvt_rtbs["RouteTables"][0]["RouteTableId"]
        print(f"  Existing Private RT found: {pvt_rtb_id}")
    else:
        res = aws(["ec2", "create-route-table", "--vpc-id", vpc_id, "--tag-specifications", "ResourceType=route-table,Tags=[{Key=Name,Value=SmartServe-Pvt-RT}]", "--region", REGION])
        pvt_rtb_id = res["RouteTable"]["RouteTableId"]
        aws(["ec2", "associate-route-table", "--route-table-id", pvt_rtb_id, "--subnet-id", subnets["SmartServe-Pvt-1a"], "--region", REGION])
        aws(["ec2", "associate-route-table", "--route-table-id", pvt_rtb_id, "--subnet-id", subnets["SmartServe-Pvt-1b"], "--region", REGION])
        print(f"  Created and associated Private RT: {pvt_rtb_id}")

    # 4. Security Groups
    print("\n[4/10] Creating Security Groups...")
    # EC2 SG
    ec2_sgs = aws(["ec2", "describe-security-groups", "--filters", "Name=group-name,Values=smartserve-ec2-sg", f"Name=vpc-id,Values={vpc_id}", "--region", REGION])
    if ec2_sgs.get("SecurityGroups"):
        ec2_sg_id = ec2_sgs["SecurityGroups"][0]["GroupId"]
        print(f"  Existing EC2 SG: {ec2_sg_id}")
    else:
        res = aws(["ec2", "create-security-group", "--group-name", "smartserve-ec2-sg", "--description", "Security group for SmartServe EC2 app server", "--vpc-id", vpc_id, "--tag-specifications", "ResourceType=security-group,Tags=[{Key=Name,Value=smartserve-ec2-sg}]", "--region", REGION])
        ec2_sg_id = res["GroupId"]
        # Allow HTTP 80, App Port 5000, SSH 22
        aws(["ec2", "authorize-security-group-ingress", "--group-id", ec2_sg_id, "--protocol", "tcp", "--port", "80", "--cidr", "0.0.0.0/0", "--region", REGION])
        aws(["ec2", "authorize-security-group-ingress", "--group-id", ec2_sg_id, "--protocol", "tcp", "--port", "5000", "--cidr", "0.0.0.0/0", "--region", REGION])
        aws(["ec2", "authorize-security-group-ingress", "--group-id", ec2_sg_id, "--protocol", "tcp", "--port", "22", "--cidr", "0.0.0.0/0", "--region", REGION])
        print(f"  Created EC2 SG: {ec2_sg_id}")

    # RDS SG (Port 3306 ONLY from ec2_sg_id)
    rds_sgs = aws(["ec2", "describe-security-groups", "--filters", "Name=group-name,Values=smartserve-rds-sg", f"Name=vpc-id,Values={vpc_id}", "--region", REGION])
    if rds_sgs.get("SecurityGroups"):
        rds_sg_id = rds_sgs["SecurityGroups"][0]["GroupId"]
        print(f"  Existing RDS SG: {rds_sg_id}")
    else:
        res = aws(["ec2", "create-security-group", "--group-name", "smartserve-rds-sg", "--description", "Security group for SmartServe RDS MySQL - strictly allows EC2 SG", "--vpc-id", vpc_id, "--tag-specifications", "ResourceType=security-group,Tags=[{Key=Name,Value=smartserve-rds-sg}]", "--region", REGION])
        rds_sg_id = res["GroupId"]
        aws(["ec2", "authorize-security-group-ingress", "--group-id", rds_sg_id, "--protocol", "tcp", "--port", "3306", "--source-group", ec2_sg_id, "--region", REGION])
        print(f"  Created RDS SG: {rds_sg_id} (MySQL 3306 restricted strictly to {ec2_sg_id})")

    # 5. S3 Bucket
    print("\n[5/10] S3 Bucket for Complaint Attachments...")
    bucket_name = f"smartserve-attachments-{ACCOUNT_ID}"
    existing_buckets = aws(["s3api", "list-buckets"])
    b_names = [b["Name"] for b in existing_buckets.get("Buckets", [])]
    if bucket_name in b_names:
        print(f"  Bucket {bucket_name} already exists.")
    else:
        aws(["s3api", "create-bucket", "--bucket", bucket_name, "--region", REGION, "--create-bucket-configuration", f"LocationConstraint={REGION}"])
        # Enable Block Public Access
        aws(["s3api", "put-public-access-block", "--bucket", bucket_name, "--public-access-block-configuration", "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"])
        # Enable CORS for direct web presigned uploads
        cors_config = {
            "CORSRules": [
                {
                    "AllowedHeaders": ["*"],
                    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
                    "AllowedOrigins": ["*"],
                    "ExposeHeaders": ["ETag"],
                    "MaxAgeSeconds": 3000
                }
            ]
        }
        with open("cors.json", "w") as f:
            f.write(json.dumps(cors_config))
        aws(["s3api", "put-bucket-cors", "--bucket", bucket_name, "--cors-configuration", "file://cors.json"])
        print(f"  Created private S3 bucket with CORS: {bucket_name}")

    # 6. IAM Role & Instance Profile for EC2
    print("\n[6/10] IAM Role & Instance Profile...")
    role_name = "SmartServe-EC2-Role"
    instance_profile_name = "SmartServe-EC2-InstanceProfile"
    
    trust_policy = {
        "Version": "2012-10-17",
        "Statement": [{"Effect": "Allow", "Principal": {"Service": "ec2.amazonaws.com"}, "Action": "sts:AssumeRole"}]
    }
    with open("trust.json", "w") as f:
        f.write(json.dumps(trust_policy))

    existing_roles = aws(["iam", "list-roles"])
    r_names = [r["RoleName"] for r in existing_roles.get("Roles", [])]
    if role_name not in r_names:
        aws(["iam", "create-role", "--role-name", role_name, "--assume-role-policy-document", "file://trust.json"])
        print(f"  Created IAM role: {role_name}")
    else:
        print(f"  Role {role_name} already exists.")

    # Permissions policy
    permissions = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": ["s3:GetObject", "s3:PutObject", "s3:ListBucket"],
                "Resource": [f"arn:aws:s3:::{bucket_name}", f"arn:aws:s3:::{bucket_name}/*"]
            },
            {
                "Effect": "Allow",
                "Action": ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"],
                "Resource": f"arn:aws:ssm:{REGION}:{ACCOUNT_ID}:parameter/smartserve/*"
            },
            {
                "Effect": "Allow",
                "Action": ["sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"],
                "Resource": f"arn:aws:sqs:{REGION}:{ACCOUNT_ID}:smartserve-complaint-queue"
            },
            {
                "Effect": "Allow",
                "Action": ["sns:Publish"],
                "Resource": f"arn:aws:sns:{REGION}:{ACCOUNT_ID}:smartserve-notifications-topic"
            },
            {
                "Effect": "Allow",
                "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams"],
                "Resource": f"arn:aws:logs:{REGION}:{ACCOUNT_ID}:log-group:/smartserve/*"
            },
            {
                "Effect": "Allow",
                "Action": ["cloudwatch:PutMetricData"],
                "Resource": "*"
            }
        ]
    }
    with open("permissions.json", "w") as f:
        f.write(json.dumps(permissions))
    aws(["iam", "put-role-policy", "--role-name", role_name, "--policy-name", "SmartServeAccessPolicy", "--policy-document", "file://permissions.json"])

    # Instance Profile
    profiles = aws(["iam", "list-instance-profiles-for-role", "--role-name", role_name])
    if not profiles.get("InstanceProfiles"):
        aws(["iam", "create-instance-profile", "--instance-profile-name", instance_profile_name], check=False)
        aws(["iam", "add-role-to-instance-profile", "--instance-profile-name", instance_profile_name, "--role-name", role_name], check=False)
        print(f"  Attached role to Instance Profile: {instance_profile_name}")
    else:
        print(f"  Instance Profile already attached.")

    # 7. SQS & SNS
    print("\n[7/10] SQS Queue and SNS Topic...")
    sqs_res = aws(["sqs", "create-queue", "--queue-name", "smartserve-complaint-queue", "--region", REGION])
    queue_url = sqs_res.get("QueueUrl", "")
    print(f"  SQS Queue URL: {queue_url}")

    sns_res = aws(["sns", "create-topic", "--name", "smartserve-notifications-topic", "--region", REGION])
    topic_arn = sns_res.get("TopicArn", "")
    print(f"  SNS Topic ARN: {topic_arn}")

    # 8. SSM Parameter Store
    print("\n[8/10] Initializing SSM Parameter Store...")
    db_password = os.environ.get("DB_PASSWORD", "SmartServe2026#Secure")
    jwt_secret = os.environ.get("JWT_SECRET", "smartserve_super_jwt_secret_key_2026")

    ssm_params = [
        {"name": "/smartserve/db/port", "value": "3306", "type": "String"},
        {"name": "/smartserve/db/name", "value": "smartserve_db", "type": "String"},
        {"name": "/smartserve/db/user", "value": "smartserve_admin", "type": "String"},
        {"name": "/smartserve/db/password", "value": db_password, "type": "SecureString"},
        {"name": "/smartserve/jwt/secret", "value": jwt_secret, "type": "SecureString"},
        {"name": "/smartserve/s3/bucket", "value": bucket_name, "type": "String"},
        {"name": "/smartserve/sqs/queue_url", "value": queue_url, "type": "String"},
        {"name": "/smartserve/sns/topic_arn", "value": topic_arn, "type": "String"},
        {"name": "/smartserve/aws/region", "value": REGION, "type": "String"},
    ]
    for p in ssm_params:
        aws(["ssm", "put-parameter", "--name", p["name"], "--value", p["value"], "--type", p["type"], "--overwrite", "--region", REGION])
    print("  SSM parameters initialized.")

    # 9. CloudWatch Log Group & Alarm
    print("\n[9/10] CloudWatch Log Group...")
    aws(["logs", "create-log-group", "--log-group-name", "/smartserve/app", "--region", REGION], check=False)
    print("  CloudWatch Log Group /smartserve/app verified.")

    # 10. RDS MySQL Instance
    print("\n[10/10] Provisioning RDS MySQL Database...")
    # DB Subnet Group
    db_subnet_group_name = "smartserve-db-subnet-group"
    existing_sng = aws(["rds", "describe-db-subnet-groups", "--db-subnet-group-name", db_subnet_group_name, "--region", REGION], check=False)
    if not existing_sng.get("DBSubnetGroups"):
        aws(["rds", "create-db-subnet-group", 
             "--db-subnet-group-name", db_subnet_group_name, 
             "--db-subnet-group-description", "Private DB subnet group for SmartServe RDS",
             "--subnet-ids", subnets["SmartServe-Pvt-1a"], subnets["SmartServe-Pvt-1b"],
             "--tags", "Key=Project,Value=SmartServeAI",
             "--region", REGION])
        print(f"  Created DB Subnet Group: {db_subnet_group_name}")
    else:
        print(f"  DB Subnet Group already exists: {db_subnet_group_name}")

    # DB Instance
    existing_dbs = aws(["rds", "describe-db-instances", "--db-instance-identifier", "smartserve-db", "--region", REGION], check=False)
    if not existing_dbs.get("DBInstances"):
        print("  Starting RDS instance creation (smartserve-db)...")
        aws(["rds", "create-db-instance",
             "--db-instance-identifier", "smartserve-db",
             "--db-instance-class", "db.t3.micro",
             "--engine", "mysql",
             "--allocated-storage", "20",
             "--storage-type", "gp3",
             "--master-username", "smartserve_admin",
             "--master-user-password", db_password,
             "--db-name", "smartserve_db",
             "--db-subnet-group-name", db_subnet_group_name,
             "--vpc-security-group-ids", rds_sg_id,
             "--no-publicly-accessible",
             "--backup-retention-period", "0",
             "--tags", "Key=Project,Value=SmartServeAI",
             "--region", REGION])
        print("  RDS Instance requested successfully. Running in background.")
    else:
        status = existing_dbs["DBInstances"][0]["DBInstanceStatus"]
        endpoint = existing_dbs["DBInstances"][0].get("Endpoint", {}).get("Address", "Pending")
        print(f"  RDS Instance smartserve-db exists! Status: {status}, Endpoint: {endpoint}")

    # Output inventory
    inventory = {
        "VpcId": vpc_id,
        "PublicSubnet1a": subnets["SmartServe-Pub-1a"],
        "PublicSubnet1b": subnets["SmartServe-Pub-1b"],
        "PrivateSubnet1a": subnets["SmartServe-Pvt-1a"],
        "PrivateSubnet1b": subnets["SmartServe-Pvt-1b"],
        "Ec2SecurityGroupId": ec2_sg_id,
        "RdsSecurityGroupId": rds_sg_id,
        "S3Bucket": bucket_name,
        "RoleName": role_name,
        "InstanceProfile": instance_profile_name,
        "QueueUrl": queue_url,
        "TopicArn": topic_arn,
        "DbSubnetGroup": db_subnet_group_name,
        "DbIdentifier": "smartserve-db"
    }
    inventory_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "infra_inventory.json")
    with open(inventory_path, "w") as f:
        json.dump(inventory, f, indent=2)
    print(f"\nInfrastructure inventory saved to {inventory_path}!")

if __name__ == "__main__":
    main()

