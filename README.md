### 배포 참고 (Render)

- Python 버전: 3.12.12 (`.python-version` 참고)
- Build Command: `pip install -r requirements.txt`
- Start Command 선택지  
  A) `uvicorn main:app --host 0.0.0.0 --port $PORT`  
  B) `gunicorn -k uvicorn.workers.UvicornWorker -w 2 -b 0.0.0.0:$PORT main:app`
