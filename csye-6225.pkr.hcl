packer {
  required_plugins {
    amazon = {
      version = ">= 1.0.0"
      source  = "github.com/hashicorp/amazon"
    }
    googlecompute = {
      version = ">= 1.0.0"
      source  = "github.com/hashicorp/googlecompute"
    }
  }
}

variable "artifact_path" {
  type        = string
  default     = "webapp.zip"
  description = "Local path to the application artifact"
}

variable "artifact_dest_dir" {
  type        = string
  default     = "/opt/csye6225/webapp"
  description = "Directory on the instance where the artifact will be stored"
}

variable "artifact_destination" {
  type        = string
  default     = "/opt/csye6225/webapp.zip"
  description = "Full destination path on the instance for the artifact"
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

variable "provision_script" {
  type        = string
  default     = "init-app.sh"
  description = "Path to the provisioning script"
}

variable "ssh_timeout" {
  type        = string
  default     = "5m"
  description = "Timeout for SSH to become available"
}

# --- GCP Variables ---
variable "gcp_project_id" {
  type        = string
  default     = "trydev-451920"
  description = "GCP project ID"
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
  ami_name      = var.ami_name
  instance_type = var.instance_type
  region        = var.aws_region
  ssh_timeout   = var.ssh_timeout
  source_ami_filter {
    filters = {
      name                  = var.ubuntu_image_filter
      "virtualization-type" = var.virtualization_type
      "root-device-type"    = var.root_device_type
    }
    owners      = [var.amazon_ami_owner]
    most_recent = true
  }
  ssh_username = var.ssh_username
  launch_block_device_mappings {
    device_name           = "/dev/sda1"
    volume_size           = var.volume_size
    volume_type           = var.volume_type
    delete_on_termination = true
  }
}

# --- GCP Builder ---
source "googlecompute" "ubuntu" {
  project_id              = var.gcp_project_id
  zone                    = var.gcp_zone
  machine_type            = var.gcp_machine_type
  image_name              = var.ami_name
  source_image_family     = "ubuntu-2204-lts"
  source_image_project_id = ["ubuntu-os-cloud"]
  ssh_username            = var.ssh_username
  disk_size               = var.volume_size
  disk_type               = var.gcp_disk_type
}

build {
  sources = [
    "source.amazon-ebs.ubuntu",
    "source.googlecompute.ubuntu"
  ]
  # provisioner "shell" {
  #   inline = ["sudo mkdir -p /opt/csye6225/webapp"]
  # }
  # Create the destination directory
  provisioner "shell" {
    inline = [
      "sudo mkdir -p /opt/csye6225/webapp && sudo chmod 777 /opt/csye6225/webapp"
    ]
  }

  # Upload the artifact file to the destination directory (using artifact_destination)
  provisioner "file" {
    source      = var.artifact_path
    destination = "/home/ubuntu/webapp.zip"
    generated   = true
  }

  provisioner "shell" {
    inline = ["sudo mv /home/ubuntu/webapp.zip /root/webapp.zip"]
  }



  # Run the provisioning script 
  provisioner "shell" {
    environment_vars = [
      "DB_NAME=${var.DB_NAME}",
      "DB_USER=${var.DB_USER}",
      "DB_PASSWORD=${var.DB_PASSWORD}",
      "DB_HOST=${var.DB_HOST}"
    ]
    inline = [
      "chmod +x /opt/csye6225/webapp_extracted/setup.sh",
      "/opt/csye6225/webapp/webapp_extracted/setup.sh"
    ]
  }
}
