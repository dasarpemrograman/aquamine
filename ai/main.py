from fastapi import FastAPI

app = FastAPI(title="AquaMine AI API")


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok"}
