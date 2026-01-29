def test_faq_endpoint_returns_items(client):
    response = client.get("/api/v1/help/faq")
    assert response.status_code == 200

    data = response.json()
    assert "items" in data
    assert isinstance(data["items"], list)
    assert len(data["items"]) >= 5

    for item in data["items"]:
        assert isinstance(item.get("title"), str)
        assert item["title"].strip()
        assert isinstance(item.get("body"), str)
        assert item["body"].strip()
