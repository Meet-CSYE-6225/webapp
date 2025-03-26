packer {
  required_plugins {
    amazon = {
      version = ">= 1.0.0"
      source  = "github.com/hashicorp/amazon"
    }
    # googlecompute = {
    #   version = ">= 1.0.0"
    #   source  = "github.com/hashicorp/googlecompute"
    # }
  }
}

variable "instance_type" {
  type        = string
  default     = "t2.micro"
  description = "EC2 instance type for the build (AWS)"
}

variable "ami_name" {
  type        = string
  default     = "csye6225-ami1"
  description = "Custom AMI name to be created"
}

variable "aws_region" {
  type        = string
  default     = "us-east-1"
  description = "AWS region"
}

variable "ubuntu_image_filter" {
  type        = string
  default     = "ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"
  description = "AMI filter for the Ubuntu image (Jammy)"
}

variable "virtualization_type" {
  type        = string
  default     = "hvm"
  description = "Virtualization type for the AMI"
}

variable "root_device_type" {
  type        = string
  default     = "ebs"
  description = "Root device type for the AMI"
}

variable "amazon_ami_owner" {
  type        = string
  default     = "099720109477"
  description = "Owner ID for the Ubuntu AMI"
}

variable "ssh_username" {
  type        = string
  default     = "ubuntu"
  description = "SSH username for the instance"
}

variable "volume_size" {
  type        = number
  default     = 25
  description = "EBS volume size in GB"
}

variable "volume_type" {
  type        = string
  default     = "gp2"
  description = "EBS volume type"
}

# --- GCP Variables ---
variable "gcp_project_id" {
  type        = string
  default     = "calm-rainfall-452223-r6"
  description = "Source GCP project ID"
}

variable "gcp_demo_account" {
  type        = string
  default     = ""
  description = "Destination GCP project ID where the image will be copied"
}

variable "gcp_zone" {
  type        = string
  default     = "us-east1-b"
  description = "GCP zone nearest to Boston"
}

variable "gcp_disk_type" {
  type        = string
  default     = "pd-ssd"
  description = "Disk type for GCP"
}

variable "gcp_machine_type" {
  type        = string
  default     = "e2-micro"
  description = "Machine type for GCP image building"
}
variable "gcp_destination_project_id" {
  type        = string
  default     = "tidal-fusion-452223-q0"
  description = "Destination GCP project ID"
}


variable "DB_NAME" {
  type    = string
  default = "health_check_db"
}

variable "DB_USER" {
  type    = string
  default = "meet"
}

variable "DB_HOST" {
  type    = string
  default = "localhost"
}

variable "DB_PASSWORD" {
  type    = string
  default = "password"
}

# --- AWS Builder ---
source "amazon-ebs" "ubuntu" {
  profile       = "dev"
  ami_name      = "csye-{{timestamp}}"
  instance_type = var.instance_type
  region        = var.aws_region
  source_ami_filter {
    filters = {
      name                  = var.ubuntu_image_filter
      "virtualization-type" = var.virtualization_type
      "root-device-type"    = var.root_device_type
    }
    owners      = [var.amazon_ami_owner]
    most_recent = true
  }
  ssh_username = "ubuntu"
  launch_block_device_mappings {
    device_name           = "/dev/sda1"
    volume_size           = var.volume_size
    volume_type           = var.volume_type
    delete_on_termination = true
  }

}

# --- GCP Builder ---
# source "googlecompute" "ubuntu" {
#   project_id              = var.gcp_project_id
#   zone                    = var.gcp_zone
#   machine_type            = var.gcp_machine_type
#   image_name              = "csye-{{timestamp}}"
#   source_image_family     = "ubuntu-2204-lts"
#   source_image_project_id = ["ubuntu-os-cloud"]
#   ssh_username            = "packer"
#   disk_size               = var.volume_size
#   disk_type               = var.gcp_disk_type
# }

build {
  sources = [
    "source.amazon-ebs.ubuntu"
    //"source.googlecompute.ubuntu"
  ]

  # Create destination directory
  provisioner "shell" {
    inline = [
      "mkdir -p /tmp/webapp"
    ]
  }

  # Copy the entire webapp directory to the target machine
  provisioner "file" {
    source      = "./"
    destination = "/tmp/webapp/"
  }

  provisioner "shell" {
    inline = [
      "wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb",
      "sudo dpkg -i -E ./amazon-cloudwatch-agent.deb"
    ]
  }
  provisioner "shell" {
    environment_vars = [
      "DB_NAME=${var.DB_NAME}",
      "DB_USER=${var.DB_USER}",
      "DB_PASSWORD=${var.DB_PASSWORD}",
      "DB_HOST=${var.DB_HOST}"
    ]
    inline = [
      "chmod +x /tmp/webapp/setup.sh",
      "/tmp/webapp/setup.sh"
    ]
  }
  # Step 1: Capture AMI details
  post-processor "manifest" {
    output = "ami_manifest.json"
  }

  # Step 2: Extract AMI ID and Share It
  post-processor "manifest" {
    output = "ami_manifest.json"
  }

  post-processor "shell-local" {
    only = ["amazon-ebs.aws_image"]
    inline = [
      "echo 'Fetching latest AMI ID from AWS...'",
      "AMI_ID=$(aws ec2 describe-images --owners self --filters 'Name=name,Values=csye-*' --query 'Images[-1].ImageId' --output text)",
      "echo 'Extracted AMI ID:' $AMI_ID",
      "[ -z \"$AMI_ID\" ] && echo 'Error: AMI_ID not found in AWS!' && exit 1",
      "aws ec2 modify-image-attribute --image-id $AMI_ID --launch-permission \"{\\\"Add\\\":[{\\\"UserId\\\":\\\"585008064466\\\"},{\\\"UserId\\\":\\\"619071353173\\\"}]}\" --region ${var.aws_region}"
    ]
  }
  # post-processor "shell-local" {
  #   only = ["googlecompute.gcp_image"]
  #   inline = [
  #     "echo 'Fetching latest GCP Image ID...'",
  #     "IMAGE_NAME=$(gcloud compute images list --project=${var.gcp_project_id} --filter='name~custom-node-postgres-app-*' --sort-by='~creationTimestamp' --limit=1 --format='value(NAME)')",
  #     "echo 'Extracted Image Name: ' $IMAGE_NAME",
  #     "[ -z \"$IMAGE_NAME\" ] && echo 'Error: Image name not found in GCP!' && exit 1",
  #     "echo 'Granting access to demo project...'",
  #     "gcloud compute images add-iam-policy-binding \"$IMAGE_NAME\" --project=\"${var.gcp_project_id}\" --member=\"serviceAccount:${var.gcp_demo_account}\" --role=\"roles/compute.imageUser\""
  #   ]
  # }

}


