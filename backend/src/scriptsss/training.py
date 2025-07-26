import cv2
import numpy as np
from PIL import Image
import os

recognizer = cv2.face.LBPHFaceRecognizer_create()
path = "dataset"
def getImageID(path):
    imagePaths = [os.path.join(path, f) for f in os.listdir(path) if f.endswith('.jpg')]
    faces = []
    ids = []
    for imagePath in imagePaths:
        faceImg = Image.open(imagePath).convert('L')
        faceNp = np.array(faceImg)
        Id = int(os.path.split(imagePath)[-1].split('.')[1])    # Ambil ID dari nama file
        faces.append(faceNp)
        ids.append(Id)
        cv2.imshow("Training on image...", faceNp)
        cv2.waitKey(1)
    return ids, faces
IDs, faces = getImageID(path)
recognizer.train(faces, np.array(IDs))
recognizer.write('trainer.yml')
cv2.destroyAllWindows()
print("Training selesai. Model disimpan sebagai 'trainer.xml'.")