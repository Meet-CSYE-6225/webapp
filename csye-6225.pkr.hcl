packer {
  required_plugins {
    amazon = {
      version = ">= 1.0.0"
      source  = "github.com/hashicorp/amazon"
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
  default     = "/opt/csye6225/webapp/webapp.zip"
  description = "Full destination path on the instance for the artifact"
}

variable "instance_type" {
  type        = string
  default     = "t2.micro"
  description = "EC2 instance type for the build"
}

variable "ami_name" {
  type        = string
  default     = "csye6225-ami1-try"
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
  description = "AMI filter for the Ubuntu image"
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

build {
  sources = [
    "source.amazon-ebs.ubuntu"
  ]

  # Create the destination directory and adjust its ownership
  provisioner "shell" {
    inline = [
      "sudo mkdir -p ${var.artifact_dest_dir}",
      "sudo chown ${var.ssh_username}:${var.ssh_username} ${var.artifact_dest_dir}"
    ]
  }

  # Upload the artifact file
  provisioner "file" {
    source      = var.artifact_path
    destination = var.artifact_destination
    generated   = true
  }

  # Run the provisioning script with sudo and inject ARTIFACT_PATH into the command
  provisioner "shell" {
    script          = var.provision_script
    execute_command = "sudo ARTIFACT_PATH=${var.artifact_destination} bash {{ .Path }}"
  }
}

