import subprocess
import json
import time

REGION = "eu-north-1"
ACCOUNT_ID = "548931595895"

def aws(args, check=False):
    cmd = ["aws"] + args + ["--output", "json"]
    print(f"[AWS] {' '.join(cmd)}")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.stdout.strip():
        try:
            return json.loads(res.stdout)
        except Exception:
            return res.stdout.strip()
    return {}

def main():
    print("==================================================")
    print("  SMARTSERVE AI - SAFE SHUTDOWN & CLEANUP SCRIPT  ")
    print("==================================================")
    confirm = input("Are you sure you want to delete all SmartServe AI resources? (yes/no): ")
    if confirm.lower() != "yes":
        print("Cleanup aborted.")
        return

    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    inv_path = os.environ.get("INVENTORY_PATH", os.path.join(project_root, "infra_inventory.json"))
    try:
        with open(inv_path, "r") as f:
            inv = json.load(f)
    except Exception:
        inv = {}

    # 1. Terminate EC2 Instance
    print("\n[1/8] Terminating EC2 instance...")
    inst_id = inv.get("InstanceId")
    if inst_id:
        aws(["ec2", "terminate-instances", "--instance-ids", inst_id, "--region", REGION])
        print(f"  Terminated EC2: {inst_id}")

    # 2. Delete CloudWatch Alarm
    print("\n[2/8] Deleting CloudWatch alarm...")
    aws(["cloudwatch", "delete-alarms", "--alarm-names", "SmartServe-EC2-HighCPU-Alarm", "--region", REGION])

    # 3. Delete RDS MySQL DB
    print("\n[3/8] Deleting RDS Database...")
    aws(["rds", "delete-db-instance", 
         "--db-instance-identifier", "smartserve-db", 
         "--skip-final-snapshot", 
         "--delete-automated-backups", 
         "--region", REGION])
    print("  RDS smartserve-db deletion requested.")

    # 4. SQS and SNS
    print("\n[4/8] Deleting SQS and SNS...")
    queue_url = inv.get("QueueUrl")
    if queue_url:
        aws(["sqs", "delete-queue", "--queue-url", queue_url, "--region", REGION])
    topic_arn = inv.get("TopicArn")
    if topic_arn:
        aws(["sns", "delete-topic", "--topic-arn", topic_arn, "--region", REGION])

    # 5. Empty and Delete S3 Bucket
    print("\n[5/8] Emptying and deleting S3 bucket...")
    bucket = inv.get("S3Bucket", f"smartserve-attachments-{ACCOUNT_ID}")
    aws(["s3", "rm", f"s3://{bucket}", "--recursive", "--region", REGION])
    aws(["s3api", "delete-bucket", "--bucket", bucket, "--region", REGION])

    # 6. Delete SSM Parameters
    print("\n[6/8] Deleting SSM parameters...")
    ssm_names = [
        "/smartserve/db/host", "/smartserve/db/port", "/smartserve/db/name",
        "/smartserve/db/user", "/smartserve/db/password", "/smartserve/jwt/secret",
        "/smartserve/s3/bucket", "/smartserve/sqs/queue_url", "/smartserve/sns/topic_arn",
        "/smartserve/aws/region"
    ]
    aws(["ssm", "delete-parameters", "--names"] + ssm_names + ["--region", REGION])

    # 7. Wait for EC2 to terminate before deleting Security Groups & VPC
    print("\n[7/8] Waiting for EC2 termination before removing networking...")
    if inst_id:
        for _ in range(25):
            desc = aws(["ec2", "describe-instances", "--instance-ids", inst_id, "--region", REGION])
            try:
                state = desc["Reservations"][0]["Instances"][0]["State"]["Name"]
                if state == "terminated":
                    print("  EC2 instance terminated.")
                    break
            except Exception:
                break
            time.sleep(5)

    # 8. Delete Networking (Security Groups, Subnets, Route Tables, IGW, VPC)
    print("\n[8/8] Deleting VPC and networking...")
    ec2_sg = inv.get("Ec2SecurityGroupId")
    rds_sg = inv.get("RdsSecurityGroupId")
    if rds_sg:
        aws(["ec2", "delete-security-group", "--group-id", rds_sg, "--region", REGION])
    if ec2_sg:
        aws(["ec2", "delete-security-group", "--group-id", ec2_sg, "--region", REGION])

    vpc_id = inv.get("VpcId")
    if vpc_id:
        # Detach and delete IGW
        igws = aws(["ec2", "describe-internet-gateways", "--filters", f"Name=attachment.vpc-id,Values={vpc_id}", "--region", REGION])
        for igw in igws.get("InternetGateways", []):
            igw_id = igw["InternetGatewayId"]
            aws(["ec2", "detach-internet-gateway", "--internet-gateway-id", igw_id, "--vpc-id", vpc_id, "--region", REGION])
            aws(["ec2", "delete-internet-gateway", "--internet-gateway-id", igw_id, "--region", REGION])

        # Delete subnets
        for sub_key in ["PublicSubnet1a", "PublicSubnet1b", "PrivateSubnet1a", "PrivateSubnet1b"]:
            sub_id = inv.get(sub_key)
            if sub_id:
                aws(["ec2", "delete-subnet", "--subnet-id", sub_id, "--region", REGION])

        # Delete VPC
        aws(["ec2", "delete-vpc", "--vpc-id", vpc_id, "--region", REGION])
        print(f"  VPC {vpc_id} deleted.")

    print("\nSmartServe AI cleanup completed.")

if __name__ == "__main__":
    main()

