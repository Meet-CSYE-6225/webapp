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
  default     = "/opt/csye6225/webapp/webapp.zip"
  description = "Full destination path on the instance for the artifact"
}

variable "ssh_username" {
  type        = string
  default     = "ubuntu"
  description = "SSH username for the instance"
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


# AWS

variable "instance_type" {
  type        = string
  default     = "t2.micro"
  description = "EC2 instance type for the build (AWS)"
}

variable "ami_name" {
  type        = string
  default     = "csye6225-ami1-try"
  description = "Custom AMI name to be created (AWS)"
}

variable "aws_region" {
  type        = string
  default     = "us-east-1"
  description = "AWS region"
}

variable "ubuntu_image_filter" {
  type        = string
  default     = "ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"
  description = "AMI filter for the Ubuntu image (AWS)"
}

variable "virtualization_type" {
  type        = string
  default     = "hvm"
  description = "Virtualization type for the AMI (AWS)"
}

variable "root_device_type" {
  type        = string
  default     = "ebs"
  description = "Root device type for the AMI (AWS)"
}

variable "amazon_ami_owner" {
  type        = string
  default     = "099720109477"
  description = "Owner ID for the Ubuntu AMI (AWS)"
}

variable "volume_size" {
  type        = number
  default     = 25
  description = "Disk size in GB"
}

variable "volume_type" {
  type        = string
  default     = "gp2"
  description = "EBS volume type (AWS)"
}


#

variable "gcp_project_id" {
  type        = string
  default     = "your-gcp-project-id"  # Replace or override via secrets
  description = "GCP Project ID"
}

variable "gcp_zone" {
  type        = string
  default     = "us-east4-a"
  description = "GCP Zone"
}

variable "gcp_machine_type" {
  type        = string
  default     = "e2-micro"
  description = "GCP machine type"
}

variable "gcp_image_name" {
  type        = string
  default     = "csye6225-gcp-image"
  description = "Name for the GCP custom image"
}

variable "gcp_source_image_family" {
  type        = string
  default     = "ubuntu-2404-lts"
  description = "GCP source image family"
}

variable "gcp_source_image_project_id" {
  type        = string
  default     = "ubuntu-os-cloud"
  description = "GCP source image project id"
}

variable "gcp_disk_type" {
  type        = string
  default     = "pd-standard"
  description = "GCP disk type"
}


# AWS Source

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


# GCP Source

source "googlecompute" "ubuntu" {
  project_id              = var.gcp_project_id
  zone                    = var.gcp_zone
  machine_type            = var.gcp_machine_type
  image_name              = var.gcp_image_name
  source_image_family     = var.gcp_source_image_family
  source_image_project_id = var.gcp_source_image_project_id
  ssh_username            = var.ssh_username
  disk_size               = var.volume_size
  disk_type               = var.gcp_disk_type
}


build {
  sources = [
    "source.amazon-ebs.ubuntu",
    "source.googlecompute.ubuntu"
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

  provisioner "shell" {
    script          = var.provision_script
    execute_command = "sudo ARTIFACT_PATH=${var.artifact_destination} bash {{ .Path }}"
  }
}
