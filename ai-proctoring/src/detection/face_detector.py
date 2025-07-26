import cv2
import numpy as np
from tensorflow.keras.models import load_model

class FaceDetector:
    def __init__(self):
        self.face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
        
    def detect(self, frame):
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = self.face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(30, 30)
        )
        return faces

    def process_frame(self, frame):
        faces = self.detect(frame)
        result = {
            'face_detected': len(faces) > 0,
            'multiple_faces': len(faces) > 1,
            'face_locations': faces.tolist()
        }
        return result