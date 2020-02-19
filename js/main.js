function wrapper(){

  //store width in pixels
  var h = $("div.map").height();
  var w = $("div.map").width();

  //initialize svg
  var svg = d3.select("div.map")
              .append("svg")
              .attr("viewBox", `0 0 ${w} ${h}`)
              // .attr("width", "100%")
              // .attr("height", "100%");

  const centerLocation = {
      "longitude": -90.2299,
      "latitude": 15.7779
  };

  //check screen aspect ratio, set margins
  var aspectRatio = w/h;
  var focusArea;

  if(aspectRatio>1){
      focusArea = {
        width: h*0.9,
        height: h*0.9
      }
  } else {
      focusArea = {
        width: w,
        height: w
      }
  }

  var margins = {
    top: (h - focusArea.height)/2,
    left: (w - focusArea.width)/2
  }

  var scaleFactor = focusArea.width /600;
  console.log(scaleFactor);

  var rScale = d3.scaleSqrt()
                  .domain([0,5000])
                  .range([0, 30*scaleFactor]);

  //albers centered on guatemala
  const albersGuate = d3.geoConicEqualArea()
                      .parallels([14.8,16.8]) 
                      .rotate([centerLocation["longitude"]*-1,0,0]) //center longitude
                      //.scale(5000)
                      .center([0,centerLocation["latitude"]]); //center latitude
                      //.translate([w/2,h/2]);

  //path generator
  const path = d3.geoPath()
                 .projection(albersGuate);

  // //create scales
  // var colorScale = d3.scaleSequential(d3.interpolateMagma);


var nodePadding = 0.1;

function applySimulation(nodes){

    console.log("Starting simulation!");
    const simulation = d3.forceSimulation(nodes)
    .force("cx", d3.forceX().x(d => w / 2).strength(0.005))
    .force("cy", d3.forceY().y(d => h / 2).strength(0.005))
    .force("x", d3.forceX().x(d => path.centroid(d) ? path.centroid(d)[0] : 0).strength(0.5))
    .force("y", d3.forceY().y(d => path.centroid(d) ? path.centroid(d)[1] : 0).strength(0.5))
    .force("charge", d3.forceManyBody().strength(-1))
    .force("collide", d3.forceCollide().radius(d => rScale(d.properties.deportations_raw)  + nodePadding).strength(1))
    .stop();

    let i = 0; 
    while (simulation.alpha() > 0.01 && i < 200) {
      simulation.tick(); 
      i++;
      //console.log(`${Math.round(100*i/200)}%`)
    }

    return simulation.nodes();
}

function makeSiblingPack(features,attribute){
  for(var feature of features){

    if(feature.properties[attribute]){

      feature.properties[attribute+"_siblings"] = [];

      for(var i=0; i < feature.properties[attribute]; i++){

          feature.properties[attribute+"_siblings"].push({
            "uniqueId": i,
            "r": 0.32*scaleFactor + Math.random()*0.1
          });
      }
      feature.properties[attribute+"_siblings"] = d3.packSiblings(feature.properties[attribute+"_siblings"]);
    } 
  }
  return features;

}




  //use Promise.all([]).then to load multiple files
  Promise.all([
      d3.json("data/test.geojson"),
      // d3.json("data/violations_gen_municipios.geojson"),
      d3.json("data/municipios_topo.json"),
      d3.json("data/countries_topo.json")
    ])
    .then(function([violationsJSON,municipiosTopojson,countriesTopojson]){

      var countries = topojson.feature(countriesTopojson, countriesTopojson.objects.ne_10m_admin_0_countries).features;
      var municipioJSON = topojson.feature(municipiosTopojson, municipiosTopojson.objects.municipios);
      var municipios = municipioJSON.features;
      var violations = violationsJSON.features

      var filtered = violations.filter(function(feature){
        if(feature.properties["deportations_raw"]>0) return feature;
      });

      var deportations = makeSiblingPack(filtered,"deportations_raw");
      console.log(deportations);


      albersGuate.fitExtent( [[margins.left,margins.top],[margins.left+focusArea.width, margins.top+focusArea.height]], municipioJSON);

      var spreadViolations = applySimulation(deportations);

      //add countries
      svg.append("g")
        .selectAll(".countries")
                .data(countries)
                .enter()
                .append("path")
                    .attr("d", path)
                    .attr("class", "country");

       //add municipios
       svg.append("g")
          .selectAll(".municipio")
                    .data(municipios)
                    .enter()
                    .append("path")
                        .attr("d", path)
                        .attr("class", "municipio");

       // //add bubbles
       // svg.append("g")
       //    .selectAll("circle")
       //        .data(violations)
       //        .enter()
       //        .append("circle")
       //            .attr("class", "centroids")
       //            .attr("transform", function(d) { return "translate(" + path.centroid(d) + ")"; })
       //            .attr("r", d => rScale(d.properties.total));

       //add spread bubbles
       var circleGroups = svg.append("g")
                              .selectAll(".circleGroups")
                                  .data(spreadViolations)
                                  .enter()
                                  .append("g")
                                  .attr("transform", d => `translate(${d.x} ${d.y})`);

        var outerCircles = circleGroups.append("circle")
                  .attr("class", "outerCircle")
                  .attr("r", d => rScale(d.properties.deportations_raw));

        circleGroups.each(function(d){
              console.log(d.properties);
              console.log(d.properties["deportations_raw_siblings"]);
              for(i=0;i<d.properties["deportations_raw_siblings"].length;i++){
                  
                  d3.select(this).append("circle")
                                    .attr("class", "innerCircle")
                                      .attr("cx", d=>d.properties["deportations_raw_siblings"][i].x)
                                      .attr("cy", d=>d.properties["deportations_raw_siblings"][i].y)
                                      .attr("r", d=>d.properties["deportations_raw_siblings"][i].r-0.1);
              }
        })


        // //add focus area indicator
        // svg.append("rect")
        //       .attr("x", margins.left)
        //       .attr("y", margins.top)
        //       .attr("width", focusArea.width)
        //       .attr("height", focusArea.height)
        //       .attr("stroke", "#000")
        //       .attr("fill", "none")
        //       .attr("stroke-width", 1);


    }).catch(function(error){
      if(error){
        console.log(error);
      }
    });

}
window.onload = wrapper();
