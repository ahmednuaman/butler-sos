# butler-sos

![alt text](img/butler-sos.png "Butler SOS")



Butler SenseOps Stats ("Butler SOS") enables real-time monitoring of key Qlik Sense metrics: 

* Server RAM
* Server CPU load
* Number of currently active users
* Cache hit ratio
* Number of currently loaded documents in the QIX engine


Butler SOS sends the meteics to both MQTT and Influxdb.
The data in Influxdb can be used to create real-time dashboards like the one above. 


More extensive documentation is available on the [Ptarmigan Labs site](https://ptarmiganlabs.com/blog/2017/04/24/butler-sos-real-time-server-stats-qlik-sense).  
