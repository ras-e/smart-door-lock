#include <Arduino.h>
#include <PubSubClient.h>
#include <WiFi.h>
#include <ESPAsyncWebServer.h>
WiFiClient espClient;
PubSubClient client(espClient);
long lastMsg = 0;
char msg[50];
int value = 0;

const char* ssid = "";
const char* password = "";

// Add your MQTT Broker IP address, example:
//const char* mqtt_server = "192.168.1.144";
const char* mqtt_server = "broker.hivemq.com";
int        port     = 1883;
const char topic[]  = "kanon_topic_123";
const long interval = 8000;
unsigned long previousMillis = 0;
bool isAlive = true;
String getHTML();
AsyncWebServer server(80); 
long timer = 5000;
long startTime;

int count = 0;


// put function declarations here:
void setup() {
  // put your setup code here, to run once:
  Serial.begin(9600);
  while (!Serial) {
    ; // wait for serial port to connect. Needed for native USB port only
  }
  setup_wifi();
  client.setServer(mqtt_server, port);
  client.setCallback(callback);
  
server.on("/", HTTP_GET, [](AsyncWebServerRequest* request) { 
	   Serial.println("ESP32 Web Server: New request received:");  // for debugging 
	   Serial.println("GET /");        // for debugging 
	   request->send(200, "text/html", getHTML()); 
	 });
   server.begin();
    startTime = millis();
   
}
String getHTML(){
  String return_html;
  if (isAlive == true){
    return_html = "<html><body><h1>Status of ESP: Online</h1></body></html>";
  }
  if (isAlive == false){
    return_html = "<html><body><h1>Status of ESP: Offline</h1></body></html>";
  }
  return return_html;
}

void setup_wifi() {
  delay(10);
  // We start by connecting to a WiFi network
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
}

void callback(char* topic, byte* message, unsigned int length) {
  Serial.print("Message arrived on topic: ");
  Serial.print(topic);
  Serial.print(". Message: ");
  String messageTemp;
  Serial.println(WiFi.localIP());
  for (int i = 0; i < length; i++) {
    Serial.print((char)message[i]);
    messageTemp += (char)message[i];
  }
   if (strcmp(messageTemp.c_str(), "HB" ) == 0){
      isAlive = true;
      startTime = millis();
    }
  Serial.println();
}

void reconnect() {
  // Loop until we're reconnected
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    // Attempt to connect
    if (client.connect("OLIVERMEGAUNIKIDCLIENTLULE")) {
      Serial.println("connected");
      client.subscribe(topic);

    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      // Wait 5 seconds before retrying
      delay(5000);
    }
  }
}

void loop() {
  // put your main code here, to run repeatedly:
  if (!client.connected()) {
    reconnect();
  }
  client.loop();
 
  if (millis()-startTime > timer){
    isAlive = false;
  }
}

