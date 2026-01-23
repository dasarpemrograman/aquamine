

class TestCVAnalyzeEndpoint:
    def test_valid_jpg_upload_returns_200(self, client, sample_jpg_bytes):
        response = client.post(
            "/api/v1/cv/analyze", files={"file": ("test.jpg", sample_jpg_bytes, "image/jpeg")}
        )
        assert response.status_code == 200
        data = response.json()
        assert "confidence" in data
        assert "severity" in data
        assert "bboxes" in data
        assert "latency_ms" in data
        assert "model_version" in data
        assert data["model_version"] == "mock-v1"
        assert data["image_width"] == 200
        assert data["image_height"] == 200

    def test_valid_png_upload_returns_200(self, client, sample_png_bytes):
        response = client.post(
            "/api/v1/cv/analyze", files={"file": ("test.png", sample_png_bytes, "image/png")}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["image_width"] == 150
        assert data["image_height"] == 150

    def test_missing_file_returns_422(self, client):
        response = client.post("/api/v1/cv/analyze")
        assert response.status_code == 422
        data = response.json()
        assert data["error"] == "MISSING_FILE"
        assert "detail" in data

    def test_invalid_file_type_returns_400(self, client):
        response = client.post(
            "/api/v1/cv/analyze", files={"file": ("test.txt", b"hello world", "text/plain")}
        )
        assert response.status_code == 400
        data = response.json()
        assert data["error"] == "INVALID_FILE_TYPE"
        assert "text/plain" in data["detail"]

    def test_corrupted_image_returns_422(self, client, corrupted_bytes):
        response = client.post(
            "/api/v1/cv/analyze", files={"file": ("test.jpg", corrupted_bytes, "image/jpeg")}
        )
        assert response.status_code == 422
        data = response.json()
        assert data["error"] == "IMAGE_DECODE_FAILED"

    def test_mock_returns_consistent_results(self, client, sample_jpg_bytes):
        response1 = client.post(
            "/api/v1/cv/analyze", files={"file": ("test.jpg", sample_jpg_bytes, "image/jpeg")}
        )
        response2 = client.post(
            "/api/v1/cv/analyze", files={"file": ("test.jpg", sample_jpg_bytes, "image/jpeg")}
        )
        assert response1.status_code == 200
        assert response2.status_code == 200
        assert response1.json()["severity"] == response2.json()["severity"]
        assert response1.json()["confidence"] == response2.json()["confidence"]
        assert len(response1.json()["bboxes"]) == len(response2.json()["bboxes"])

    def test_different_images_can_produce_different_results(
        self, client, sample_jpg_bytes, sample_png_bytes
    ):
        response1 = client.post(
            "/api/v1/cv/analyze", files={"file": ("test.jpg", sample_jpg_bytes, "image/jpeg")}
        )
        response2 = client.post(
            "/api/v1/cv/analyze", files={"file": ("test.png", sample_png_bytes, "image/png")}
        )
        assert response1.status_code == 200
        assert response2.status_code == 200

    def test_small_image_adds_warning(self, client, small_image_bytes):
        response = client.post(
            "/api/v1/cv/analyze", files={"file": ("small.jpg", small_image_bytes, "image/jpeg")}
        )
        assert response.status_code == 200
        data = response.json()
        assert any("100x100" in w for w in data["warnings"])

    def test_severity_thresholds(self, client, sample_jpg_bytes):
        response = client.post(
            "/api/v1/cv/analyze", files={"file": ("test.jpg", sample_jpg_bytes, "image/jpeg")}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["severity"] in ["none", "mild", "moderate", "severe"]
        conf = data["confidence"]
        if conf < 0.3:
            assert data["severity"] == "none"
        elif conf < 0.5:
            assert data["severity"] == "mild"
        elif conf < 0.7:
            assert data["severity"] == "moderate"
        else:
            assert data["severity"] == "severe"

    def test_file_too_large_returns_413(self, client):
        large_file = b"x" * (10 * 1024 * 1024 + 1)
        response = client.post(
            "/api/v1/cv/analyze", files={"file": ("large.jpg", large_file, "image/jpeg")}
        )
        assert response.status_code == 413
        data = response.json()
        assert data["error"] == "FILE_TOO_LARGE"
        assert "10MB" in data["detail"]


class TestHealthEndpoint:
    def test_health_returns_ok(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}
