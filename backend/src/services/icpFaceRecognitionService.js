const { Actor, HttpAgent } = require('@dfinity/agent');
const fetch = require('node-fetch');
global.fetch = fetch;

class ICPFaceRecognitionService {
    constructor() {
        this.agent = new HttpAgent({
            host: process.env.IC_HOST || 'https://ic0.app'
        });
        this.canisterId = process.env.FACE_RECOGNITION_CANISTER_ID;
        this.actor = null;
        this.initialize();
    }

    async initialize() {
        try {
            if (process.env.NODE_ENV !== 'production') {
                await this.agent.fetchRootKey();
            }

            const idlFactory = ({ IDL }) => {
                return IDL.Service({
                    'detect_face': IDL.Func([IDL.Vec(IDL.Nat8)], [
                        IDL.Record({
                            'face_detected': IDL.Bool,
                            'face_count': IDL.Nat32,
                            'bounding_boxes': IDL.Vec(IDL.Record({
                                'x': IDL.Float32,
                                'y': IDL.Float32,
                                'width': IDL.Float32,
                                'height': IDL.Float32
                            }))
                        })
                    ], ['query']),
                    'recognize_face': IDL.Func([IDL.Vec(IDL.Nat8)], [
                        IDL.Record({
                            'face_detected': IDL.Bool,
                            'face_count': IDL.Nat32,
                            'face_embeddings': IDL.Vec(IDL.Float32),
                            'bounding_boxes': IDL.Vec(IDL.Record({
                                'x': IDL.Float32,
                                'y': IDL.Float32,
                                'width': IDL.Float32,
                                'height': IDL.Float32
                            }))
                        })
                    ], ['query'])
                });
            };

            this.actor = Actor.createActor(idlFactory, {
                agent: this.agent,
                canisterId: this.canisterId
            });
        } catch (error) {
            console.error('Failed to initialize ICP Face Recognition:', error);
            throw error;
        }
    }

    async detectFace(imageBuffer) {
        try {
            if (!this.actor) {
                throw new Error('ICP Face Recognition not initialized');
            }

            const result = await this.actor.detect_face(Array.from(imageBuffer));
            return {
                faceDetected: result.face_detected,
                faceCount: Number(result.face_count),
                boundingBoxes: result.bounding_boxes.map(box => ({
                    x: box.x,
                    y: box.y,
                    width: box.width,
                    height: box.height
                }))
            };
        } catch (error) {
            console.error('Face detection error:', error);
            throw error;
        }
    }

    async recognizeFace(imageBuffer) {
        try {
            if (!this.actor) {
                throw new Error('ICP Face Recognition not initialized');
            }

            const result = await this.actor.recognize_face(Array.from(imageBuffer));
            return {
                faceDetected: result.face_detected,
                faceCount: Number(result.face_count),
                faceEmbeddings: Array.from(result.face_embeddings),
                boundingBoxes: result.bounding_boxes.map(box => ({
                    x: box.x,
                    y: box.y,
                    width: box.width,
                    height: box.height
                }))
            };
        } catch (error) {
            console.error('Face recognition error:', error);
            throw error;
        }
    }
}

module.exports = new ICPFaceRecognitionService();