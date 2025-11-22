#!/bin/bash
set -e

echo "Building gbulk Debian package..."

# Build release binary
echo "Building release binary..."
cargo build --release

# Create debian directory structure if it doesn't exist
echo "Creating debian directory structure..."
mkdir -p debian/usr/bin
mkdir -p debian/usr/share/doc/gbulk

# Copy binary to debian structure
echo "Copying binary..."
cp target/release/gbulk debian/usr/bin/
chmod 755 debian/usr/bin/gbulk

# Copy documentation
echo "Copying documentation..."
cp README.md debian/usr/share/doc/gbulk/

# Build the package
echo "Building .deb package..."
dpkg-deb --build debian

# Rename to proper package name
mv debian.deb gbulk_0.1.0_amd64.deb

echo "Package created: gbulk_0.1.0_amd64.deb"
echo ""
echo "To install:"
echo "  sudo dpkg -i gbulk_0.1.0_amd64.deb"
echo ""
echo "To uninstall:"
echo "  sudo dpkg -r gbulk"
