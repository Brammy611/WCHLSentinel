import cv2 

video = cv2.VideoCapture(0)
facedetect = cv2.CascadeClassifier('data/haarcascade_frontalface_default.xml')

recognizion = cv2.face.LBPHFaceRecognizer_create()
recognizion.read('trainer.yml')
name_list = ["", "Nanda"]

while True:
    ret, frame = video.read()
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = facedetect.detectMultiScale(gray, 1.3, 5)
    for (x, y, w, h) in faces:
        serial, conf = recognizion.predict(gray[y:y+h, x:x+w])
        if conf > 50:
            cv2.putText(frame, name_list[serial], (x, y - 40), cv2.FONT_HERSHEY_SIMPLEX, 1, (50, 50, 255), 1)
            cv2.rectangle(frame, (x, y), (x + w, y + h), (50, 50, 255), 1)
        else:
            cv2.putText(frame, "Unknown", (x, y - 40), cv2.FONT_HERSHEY_SIMPLEX, 1, (50, 50, 255), 1)
            cv2.rectangle(frame, (x, y), (x + w, y + h), (50, 50, 255), 1)
        print("Serial:", serial, "Confidence:", conf)
        # Tampilkan hasil di layar
        label = "Face Detected"
        cv2.putText(frame, label, (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 0, 0), 2) 
    cv2.imshow("Frame", frame)
    
    k = cv2.waitKey(1)
    if k == ord('q'):  # 's' key to save the frame
        break
video.release()
cv2.destroyAllWindows()
print("Data wajah telah disimpan ke dalam dataset.")