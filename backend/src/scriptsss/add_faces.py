import cv2
import os

video = cv2.VideoCapture(0)
facedetect = cv2.CascadeClassifier('data/haarcascade_frontalface_default.xml')

user_id = input("Enter your ID (angka): ")
faces_data = []
i = 0

recognizer = cv2.face.LBPHFaceRecognizer_create()
recognizer.read('dataset/training.xml')

while True:
    ret, frame = video.read()
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = facedetect.detectMultiScale(gray, 1.3, 5)

    for (x, y, w, h) in faces:
        crop_img_color = frame[y:y+h, x:x+w]
        crop_img_gray = cv2.resize(gray[y:y+h, x:x+w], (200, 200))  # Sesuai data training
        id, conf = recognizer.predict(crop_img_gray)

        if id == 1:
            name = 'Ananda'
        elif id == 2:
            name = 'Cantik'
        else:
            name = 'Unknown'

        resize_img = cv2.resize(crop_img_color, (50, 50))

        if len(faces_data) < 100 and i % 10 == 0:
            faces_data.append(resize_img)
            cv2.imwrite(f"data/user.{user_id}.{len(faces_data)}.jpg", resize_img)

        i += 1

        cv2.rectangle(frame, (x, y), (x + w, y + h), (50, 50, 255), 1)
        cv2.putText(frame, f'{name} ({conf:.0f})', (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2)
        cv2.putText(frame, str(len(faces_data)), (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (50, 50, 255), 2)

    cv2.imshow('Face Detection', frame)

    if cv2.waitKey(1) == ord('q') or len(faces_data) >= 50:
        break

video.release()
cv2.destroyAllWindows()
