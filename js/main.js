//global variables
var map,
	loc,
	attrArray = ["AFT", "AHe"], //list of attributes
	expressed = attrArray[0], //initial attribute
	masterData = [],
	Links = [],
	colourArray = [],
	points;
	
//create marker options
var options = {
	 color: "#000000",
	 weight: 1,
	 opacity: 1,
	 fillOpacity: 0.8
};

//chart frame dimensions
var chartWidth = window.innerWidth * 0.3,
	chartHeight = 720,
	leftPadding = 50,
	rightPadding = 2,
	topBottomPadding = 40,
	chartInnerWidth = chartWidth - leftPadding - rightPadding,
	chartInnerHeight = chartHeight - topBottomPadding * 2,
	translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

//create a scale to size bars proportionally to frame and for axis
var yScale = d3.scaleLinear()
	.range([463, 0])
	.domain([0, 100]);
 
function initialize() {
	getMasterData();
}

function getMasterData() {
	//use Promise.all to parallelize asynchronous data loading
	var promises = []; 
	promises.push(d3.csv("data/masterData.csv")); //load masterData
	promises.push(d3.csv("data/Links.csv")); //load Links
	Promise.all(promises).then(callback);		
	
	function callback(data) {
		masterData = data[0],
		Links = data[1];
		
		randomColours();
		createMap();
		createDropdown();
	};
	
	fetch("data/AlaskaFaults.geojson")
        .then(function(response){
            return response.json();
        })
        .then(function(json){			
            //call function to create proportional symbols
            createFautlsSymbols(json, attrArray);
		
        })
};

//Add circle markers for point features to the map
function createFautlsSymbols(data, attributes){
	//create marker options
	var Faultoptions = {
		 color: "#000000",
		 weight: 2,
		 opacity: 1,
		 fillOpacity: 0.8
	};
	//create a Leaflet GeoJSON layer and add it to the map
	var Faults = L.geoJson(data, Faultoptions).addTo(map);
	 
	Faults.eachLayer(function(layer){
		var slip;
		if (layer.feature.properties.SLIPSENSE == "SS") {
			slip = "Strike Slip Fault";
		} else if (layer.feature.properties.SLIPSENSE == "N") {
			slip = "Normal Fault";
		} else if (layer.feature.properties.SLIPSENSE == "R") {
			slip = "Reverse Fault";
		} else if (layer.feature.properties.SLIPSENSE == "T") {
			slip = "Thrust Fault";
		} else {
			slip = "unkown";
		}
		layer.bindPopup("<strong>" + layer.feature.properties.NAME +"</strong><br><b>Fault type: </b>"+ slip +"<br><b>Slip Rate: </b>"+ layer.feature.properties.SLIPRATE + " mm/yr<br><b> Dip Direction: </b>" + layer.feature.properties.DIPDIRECTI + "<br><b>Fault location: </b>"+layer.feature.properties.FTYPE);
	});
};

function createMap(){
	var USGS = L.tileLayer('https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}', {
			 maxZoom: 20,
			 attribution: 'Tiles courtesy of the <a href="https://usgs.gov/">U.S. Geological Survey</a>'
		});
	
	var USGS_USImageryTopo = L.tileLayer('https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryTopo/MapServer/tile/{z}/{y}/{x}', {
		maxZoom: 20,
		attribution: 'Tiles courtesy of the <a href="https://usgs.gov/">U.S. Geological Survey</a>'
	});

	var baseMaps = {
		"National Map": USGS,
		"USGS Topo" : USGS_USImageryTopo,
	};

    //create the map
	map = L.map('map', {
		zoomControl: false,
		center: [61.5, -145],
		zoom: 6,
		layers: [USGS]
	});

	var layerControl = L.control.layers(baseMaps).addTo(map);

	L.control.zoom({
		position: 'topright'
	}).addTo(map);
	
	//call getData function
    getData();
};

function getData(){
	var csvLoc = "data/" + expressed + "Data.csv";
	var promises = []; 
		promises.push(d3.csv(csvLoc));
	Promise.all(promises).then(callback);		
		
	function callback(data) {
		csvData = data[0];
		
		makeGraph(csvData);
		createTable(csvData);
	}
	
	loc = "data/" + expressed + ".geojson";
    //load the data
    fetch(loc)
        .then(function(response){
            return response.json();
        })
        .then(function(json){			
            //call function to create proportional symbols
            createPropSymbols(json, attrArray);
		
        })
};

//Create histogram (adapted from: https://d3-graph-gallery.com/graph/histogram_basic.html)
function makeGraph(csvData) {
	//make chart
	var chart = d3.select("#chart")
		.append("svg")
			.attr("width", chartWidth)
			.attr("height", chartHeight)
			.attr("class", "chart")
		.append("g")
			.attr("transform", "translate(" + leftPadding + "," + topBottomPadding + ")");
	//make chart title position
	var chartTitle = chart.append("text")
			.attr("x", 55)
			.attr("y", 40)
			.attr("class", "chartTitle")
			
	//x axis
	var x = d3.scaleLinear()
		.domain([0, d3.max(csvData, function(d) { return +d.Age })])
		.range([0, chartInnerWidth]);
	chart.append("g")
		.attr("transform", "translate(0," + chartInnerHeight + ")")
		.call(d3.axisBottom(x));

	var bins = Math.ceil(d3.max(csvData, function(d) { return +d.Age }) / 2) //Creates bin size of 2 Ma

	//set the parameters for the histogram
	var histogram = d3.histogram()
		.value(function(d) { return d.Age; }) 
		.domain(x.domain()) 
		.thresholds(x.ticks(bins));

	var bins = histogram(csvData);

	//y axis
	var y = d3.scaleLinear()
		.range([chartInnerHeight, 0]);
		y.domain([0, d3.max(bins, function(d) { return d.length; })]);   // d3.hist has to be called before the Y axis obviously
	chart.append("g")
		.call(d3.axisLeft(y));

	//append the bar rectangles
	chart.selectAll("rect")
		.data(bins)
		.enter()
		.append("rect")
			.attr("x", 1)
			.attr("transform", function(d) { return "translate(" + x(d.x0) + "," + y(d.length) + ")"; })
			.attr("width", function(d) { return x(d.x1) - x(d.x0) -1 ; })
			.attr("height", function(d) { return chartInnerHeight - y(d.length); })
			.style("fill", "#FFB612")
			
	chart.append("text")	//text label for the x axis
		.attr("x", chartWidth / 2 )
		.attr("y",  chartHeight - topBottomPadding * 1.24)
		.style("text-anchor", "middle")
		.text("Ages Ma");
		
	chart.append("text")	//text label for the y axis
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - leftPadding)
        .attr("x",0 - (chartInnerHeight / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .text("n");
		
	var chartTitle = d3.select(".chartTitle") //chart title
				.text(expressed + " (n: " + csvData.length + ")");
}

//Add circle markers for point features to the map
function createPropSymbols(data, attributes){
	 //create a Leaflet GeoJSON layer and add it to the map
	 points = L.geoJson(data, {
		pointToLayer: function(feature, latlng){
			return pointToLayer(feature, latlng, attributes);
		}
	 }).addTo(map);
};

//function to convert markers to circle markers
function pointToLayer(feature, latlng, attributes){
	
	//For each feature, determine its value for the selected attribute
	var attValue = feature.properties.Ref;
	 
	//Give each feature's circle marker a radius
	options.radius = 5;
	
	options.fillColor = makeColours(attValue);
	 
	//create circle marker layer
	var layer = L.circleMarker(latlng, options);
	 	 
	//build popup content string
	var popupContent = createPopupContent(feature.properties);
	
	//bind the popup to the circle marker 
	layer.bindPopup(popupContent, { offset: new L.Point(0,-options.radius) });
	 
	layer.on("click", highlight);
	 
	//return the circle marker to the L.geoJson pointToLayer option
	return layer;
};

function createPopupContent(properties){
	//add state to popup content string
	var popupContent = "<p><b>Sample:</b> " + properties.Sample + "</p>";
	popupContent += "<p><b>Age:</b> " + properties.Age + " Ma</p>";
	popupContent += "<p><b>STD:</b> " + properties.STD + " Ma</p>";
	popupContent += "<p><b>Paper:</b> " + properties.Ref + "</p>";
	 
	 
	return popupContent;
};

function randomColours() {
	for (var j=0; j<Links.length; j++) {
		var colour = "rgb(";
			for (var i=0; i<3; i++){
				var random = Math.round(Math.random() * 255);
				colour += random;
				if (i<2){
					colour += ",";
				} else {
					colour += ")";
				}
			}
			colourArray[j] = colour;
	};
};

function makeColours(attValue) {
	var colours = "#000000"
	for (var i=0; i<Links.length; i++) {
		if(attValue==Links[i].Ref) {
			colours = colourArray[i];
		}
	}
	return colours;
};

//function to create a dropdown menu for attribute selection
function createDropdown(){
	//add select element
	var dropdown = d3.select("#dropdown")
		.append("select")
		.attr("class", "dropdown")
		.on("change", function(){
			expressed = this.value;
			changeData();
		});
	//add initial option
	var titleOption = dropdown.append("option")
	.attr("class", "titleOption")
	.attr("disabled", "true")
	.text("Select Data");
	
	//add attribute name options
	var attrOptions = dropdown.selectAll("attrOptions")
		.data(attrArray)
		.enter()
		.append("option")
		.attr("value", function(d){ return d })
		.text(function(d){ return d });
};

function createTable(csvData) {
	
	var counts = csvData.reduce((p, c) => {
		var Ref = c.Ref;
		if (!p.hasOwnProperty(Ref)) {
			p[Ref] = 0;
		}
		p[Ref]++;
		return p;
	}, {});

	var countsExtended = Object.keys(counts).map(k => {
		return {Ref: k, count: counts[k]}; });
	
	var unique = [...new Set(csvData.map(item => item.Ref))]; //Gets all unique instance of Ref
	table = document.getElementById("table")
	
	for(var i=0; i < unique.length; i++) {
		if (i == 0) {
			table.innerHTML = "<strong>Paper: Number of Samples</strong><br>"; //Adds header to table
		}
		for(var j=0; j<Links.length; j++) {
			if (unique[i] == Links[j].Ref) {
				for(var k=0; k<countsExtended.length; k++) {
					if(countsExtended[k].Ref == Links[j].Ref) {
					//Adds ref name, ref link, and count of ref to table div
					table.innerHTML += '<a href="'+ Links[j].Links +'" target="_blank"><b>'+ Links[j].Ref + ': '+ countsExtended[k].count +'</b></a><br>';
						}
				}
			}
		}
	}
}
//Highlight ref in table that corresponds to clicked sample
function highlight(e) {
	//if highlight exists, remove
	document.querySelector('.highlight')?.classList.remove('highlight');
	//looks for ref in table
	var text = this.feature.properties.Ref
	var inputText = document.getElementById("table");
	var innerHTML = inputText.innerHTML;
	var index = innerHTML.indexOf(text);
	if (index >= 0) { 
		innerHTML = innerHTML.substring(0,index) + "<span class='highlight'>" + innerHTML.substring(index,index+text.length) + "</span>" + innerHTML.substring(index + text.length);
		inputText.innerHTML = innerHTML;
	}
}

function changeData() {
	points.remove();
	document.getElementById("table").innerHTML = "";
	document.getElementById("chart").innerHTML = "";
	
    getData();
}

document.addEventListener('DOMContentLoaded', initialize)