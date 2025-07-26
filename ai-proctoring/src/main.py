import cv2
import numpy as np
from tensorflow.keras.models import load_model
from .detection.face_detector import FaceDetector
from .detection.gaze_tracker import GazeTracker

class ProctoringSystem:
    def __init__(self):
        self.face_detector = FaceDetector()
        self.gaze_tracker = GazeTracker()
        
    def analyze_frame(self, frame):
        faces = self.face_detector.detect(frame)
        if len(faces) == 0:
            return {"warning": "No face detected"}
        elif len(faces) > 1:
            return {"warning": "Multiple faces detected"}
            
        gaze_direction = self.gaze_tracker.track(frame, faces[0])
        return {
            "face_detected": True,
            "gaze_direction": gaze_direction
        }

def start_proctoring(user_id, exam_id):
    proctor = ProctoringSystem()
    # Initialize webcam stream processing
    pass