#!/bin/bash

echo "🚀 Complete Setup Script for ICP Face Recognition Integration"
echo "============================================================"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
print_status "Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is required but not installed."
    exit 1
fi

# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm is required but not installed."
    exit 1
fi

# Check dfx
if ! command -v dfx &> /dev/null; then
    print_error "dfx is required but not installed. Please install IC SDK from https://internetcomputer.org/docs/current/developer-docs/getting-started/install"
    exit 1
fi

# Check Rust
if ! command -v rustc &> /dev/null; then
    print_error "Rust is required but not installed. Please install from https://rustup.rs/"
    exit 1
fi

# Check Python3
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is required but not installed."
    exit 1
fi

print_success "All prerequisites found!"

# Create project structure
print_status "Creating project structure..."

# Create directories
mkdir -p src/face_recognition
mkdir -p models
mkdir -p dataset
mkdir -p scripts

# Install required npm packages
print_status "Installing Node.js dependencies..."
npm install @dfinity/agent @dfinity/principal @dfinity/candid

# Install required Rust tools
print_status "Installing Rust tools..."
if ! command -v wasi2ic &> /dev/null; then
    print_warning "Installing wasi2ic..."
    cargo install wasi2ic
fi

if ! command -v ic-file-uploader &> /dev/null; then
    print_warning "Installing ic-file-uploader..."
    cargo install ic-file-uploader
fi

if ! command -v wasm-opt &> /dev/null; then
    print_warning "Installing wasm-opt..."
    cargo install wasm-opt
fi

# Install Python dependencies
print_status "Installing Python dependencies..."
pip3 install torch torchvision facenet-pytorch onnx opencv-python

# Download models
print_status "Downloading and preparing models..."

# Download Ultraface model if not exists
if [ ! -f "models/version-RFB-320.onnx" ]; then
    print_status "Downloading Ultraface detection model..."
    curl -L "https://github.com/onnx/models/raw/main/validated/vision/body_analysis/ultraface/models/version-RFB-320.onnx" -o models/version-RFB-320.onnx
    print_success "Ultraface model downloaded"
else
    print_success "Ultraface model already exists"
fi

# Generate FaceNet model
if [ ! -f "models/face-recognition.onnx" ]; then
    print_status "Generating FaceNet recognition model..."
    python3 -c "
import torch
import sys
try:
    import facenet_pytorch
except ImportError:
    print('Installing facenet-pytorch...')
    import subprocess
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'facenet-pytorch', 'torch', 'onnx'])
    import facenet_pytorch

print('Exporting FaceNet model...')
resnet = facenet_pytorch.InceptionResnetV1(pretrained='vggface2').eval()
input_tensor = torch.randn(1, 3, 160, 160)
torch.onnx.export(resnet, input_tensor, 'models/face-recognition.onnx', 
                  verbose=False, opset_version=11, 
                  input_names=['input'], output_names=['output'])
print('✅ FaceNet model exported successfully')
"
    print_success "FaceNet model generated"
else
    print_success "FaceNet model already exists"
fi

# Create Rust project files
print_status "Setting up Rust canister..."

# Copy the Candid definition
cat > src/face_recognition/face_recognition.did << 'EOF'
type BoundingBox = record {
    x: float32;
    y: float32;
    width: float32;
    height: float32;
};

type FaceDetectionResult = record {
    face_detected: bool;
    face_count: nat32;
    bounding_boxes: vec BoundingBox;
};

type FaceRecognitionResult = record {
    face_detected: bool;
    face_count: nat32;
    face_embeddings: vec float32;
    bounding_boxes: vec BoundingBox;
};

type ModelStatus = variant {
    NotLoaded;
    Loading;
    Ready;
    Error: text;
};

type CanisterStats = record {
    face_detection_model_status: ModelStatus;
    face_recognition_model_status: ModelStatus;
    total_detections: nat64;
    total_recognitions: nat64;
    model_detection_size: nat64;
    model_recognition_size: nat64;
};

service : {
    "setup_models": () -> (text);
    "clear_face_detection_model_bytes": () -> ();
    "clear_face_recognition_model_bytes": () -> ();
    "append_face_detection_model_bytes": (vec nat8) -> ();
    "append_face_recognition_model_bytes": (vec nat8) -> ();
    "detect_face": (vec nat8) -> (FaceDetectionResult) query;
    "recognize_face": (vec nat8) -> (FaceRecognitionResult) query;
    "get_stats": () -> (CanisterStats) query;
    "health_check": () -> (bool) query;
    "reset_stats": () -> ();
}
EOF

# Start dfx
print_status "Starting dfx..."
if ! dfx ping &> /dev/null; then
    dfx start --clean --background
    sleep 5
fi

# Deploy canister
print_status "Deploying face recognition canister..."
dfx deploy face_recognition

# Get canister ID
CANISTER_ID=$(dfx canister id face_recognition)
print_success "Canister deployed with ID: $CANISTER_ID"

# Upload models to canister
print_status "Uploading models to canister..."

print_status "Clearing existing models..."
dfx canister call face_recognition clear_face_detection_model_bytes
dfx canister call face_recognition clear_face_recognition_model_bytes

print_status "Uploading face detection model (this may take a while)..."
ic-file-uploader face_recognition append_face_detection_model_bytes models/version-RFB-320.onnx

print_status "Uploading face recognition model (this may take a while)..."
ic-file-uploader face_recognition append_face_recognition_model_bytes models/face-recognition.onnx

print_status "Setting up models in canister..."
dfx canister call face_recognition setup_models

# Test canister
print_status "Testing canister health..."
HEALTH_CHECK=$(dfx canister call face_recognition health_check)
if [[ $HEALTH_CHECK == *"true"* ]]; then
    print_success "Canister health check passed!"
else
    print_warning "Canister health check failed. Models may not be loaded properly."
fi

# Create environment configuration
print_status "Creating environment configuration..."
cat > .env.icp << EOF
# ICP Face Recognition Configuration
FACE_RECOGNITION_CANISTER_ID=$CANISTER_ID
IC_HOST=https://ic0.app
NODE_ENV=development

# Add these to your main .env file:
FACE_RECOGNITION_CANISTER_ID=$CANISTER_ID
IC_HOST=https://ic0.app
EOF

# Update package.json scripts
print_status "Updating package.json scripts..."
if [ -f "package.json" ]; then
    # Add ICP-related scripts to package.json
    npm pkg set scripts.icp:setup="./scripts/setup-icp.sh"
    npm pkg set scripts.icp:deploy="dfx deploy face_recognition"
    npm pkg set scripts.icp:test="dfx canister call face_recognition health_check"
    npm pkg set scripts.icp:stats="dfx canister call face_recognition get_stats"
fi

# Create test script
cat > scripts/test-icp-integration.js << 'EOF'
const { HttpAgent, Actor } = require('@dfinity/agent');
const fs = require('fs');

async function testICPIntegration() {
    const canisterId = process.env.FACE_RECOGNITION_CANISTER_ID;
    
    if (!canisterId) {
        console.error('❌ FACE_RECOGNITION_CANISTER_ID not set in environment');
        return;
    }
    
    console.log(`🧪 Testing ICP integration with canister: ${canisterId}`);
    
    try {
        const agent = new HttpAgent({
            host: 'http://127.0.0.1:4943'
        });
        
        await agent.fetchRootKey();
        
        const idlFactory = ({ IDL }) => {
            return IDL.Service({
                'health_check': IDL.Func([], [IDL.Bool], ['query']),
                'get_stats': IDL.Func([], [IDL.Record({
                    'face_detection_model_status': IDL.Variant({
                        'NotLoaded': IDL.Null,
                        'Loading': IDL.Null,
                        'Ready': IDL.Null,
                        'Error': IDL.Text
                    }),
                    'face_recognition_model_status': IDL.Variant({
                        'NotLoaded': IDL.Null,
                        'Loading': IDL.Null,
                        'Ready': IDL.Null,
                        'Error': IDL.Text
                    }),
                    'total_detections': IDL.Nat64,
                    'total_recognitions': IDL.Nat64,
                    'model_detection_size': IDL.Nat64,
                    'model_recognition_size': IDL.Nat64
                })], ['query'])
            });
        };
        
        const actor = Actor.createActor(idlFactory, {
            agent,
            canisterId
        });
        
        const healthCheck = await actor.health_check();
        console.log(`✅ Health check: ${healthCheck}`);
        
        const stats = await actor.get_stats();
        console.log('📊 Canister stats:', stats);
        
        console.log('🎉 ICP integration test completed successfully!');
        
    } catch (error) {
        console.error('❌ ICP integration test failed:', error);
    }
}

testICPIntegration();
EOF

chmod +x scripts/test-icp-integration.js

# Final setup instructions
print_success "🎉 ICP Face Recognition setup completed!"
echo ""
echo "📋 Setup Summary:"
echo "  ✅ Models downloaded and uploaded to canister"
echo "  ✅ Canister deployed with ID: $CANISTER_ID"
echo "  ✅ Node.js dependencies installed"
echo "  ✅ Environment configuration created"
echo ""
echo "🔧 Next Steps:"
echo "  1. Add the following to your main .env file:"
echo "     FACE_RECOGNITION_CANISTER_ID=$CANISTER_ID"
echo "     IC_HOST=https://ic0.app"
echo ""
echo "  2. Update your aiProctoringService.js to use the new ICP implementation"
echo ""
echo "  3. Test the integration:"
echo "     node scripts/test-icp-integration.js"
echo ""
echo "  4. Restart your application server"
echo ""
echo "🔍 Useful Commands:"
echo "  - Check canister health: dfx canister call face_recognition health_check"
echo "  - View canister stats: dfx canister call face_recognition get_stats"
echo "  - Test with image: dfx canister call face_recognition detect_face '(vec {})'"
echo ""
echo "📖 Documentation:"
echo "  - ICP Face Recognition: https://internetcomputer.org/docs/references/samples/rust/face-recognition/"
echo "  - DFINITY Examples: https://github.com/dfinity/examples"