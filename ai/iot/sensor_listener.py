import paho.mqtt.client as mqtt
import json
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import config

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("Connected to MQTT Broker!")
        client.subscribe(config.MQTT_TOPIC)
    else:
        print(f"Failed to connect, return code {rc}")

def on_message(client, userdata, msg):
    try:
        payload = msg.payload.decode()
        data = json.loads(payload)
        print(f"Received message on topic {msg.topic}: {data}")
        # TO DO: Add processing logic for the sensor data here
    except Exception as e:
        print(f"Error processing message: {e}")

def main():
    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message

    try:
        client.connect(config.MQTT_BROKER, config.MQTT_PORT, 60)
        client.loop_forever()
    except Exception as e:
        print(f"Could not connect to MQTT Broker: {e}")

if __name__ == "__main__":
    main()
