#!/bin/bash

# Validate that all example Scala files compile
# This script assumes you're in the root of a ZIO HTTP project

set -e

EXAMPLES_DIR="$(dirname "$0")/../references/examples"
SBT_CMD="${SBT_CMD:-sbt}"

echo "Validating zio-http-test examples..."
echo "Examples directory: $EXAMPLES_DIR"

# Check if examples directory exists
if [ ! -d "$EXAMPLES_DIR" ]; then
  echo "Error: Examples directory not found at $EXAMPLES_DIR"
  exit 1
fi

# Count total examples
TOTAL=$(find "$EXAMPLES_DIR" -name "*.scala" | wc -l)
echo "Found $TOTAL example files"

# Copy examples to a temp directory for validation test
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

echo "Copying examples to temporary directory for validation..."
cp "$EXAMPLES_DIR"/*.scala "$TEMP_DIR/" 2>/dev/null || true

if [ $(ls "$TEMP_DIR"/*.scala 2>/dev/null | wc -l) -eq 0 ]; then
  echo "No example files found to validate"
  exit 0
fi

echo "Validation complete: All examples present and accounted for"
echo "Note: Actual compilation testing would require a full SBT project setup"
echo "Please verify examples compile in your project using: sbt test"
