#!/bin/sh
set -e
cd "$(dirname "$0")/.."
xcrun simctl addmedia booted assets/fake-receipts/cafe-receipt.png assets/fake-receipts/fuel-receipt.png assets/fake-receipts/office-receipt.png
echo "Added cafe, fuel, and office receipts to the booted simulator photo library."
