


// general comments: ring.js, offramp.js (responsive design)

//#############################################################
// Initial settings
//#############################################################

var scenarioString="OnRamp";

// graphical settings

var hasChanged=true; // window dimensions have changed (responsive design)

var drawBackground=false; // if false, default unicolor background
var drawRoad=true; // if false, only vehicles are drawn
var changedRoadGeometry; //!!! true only if user-driven geometry changes

var drawColormap=false;
var vmin=0; // min speed for speed colormap (drawn in red)
var vmax=100/3.6; // max speed for speed colormap (drawn in blue-violet)


// physical geometry settings [m]
// sizePhys=physical dimension; should be of the order of vertical extension

// fixed at initialization; relevant for actual simulation

var mainroadLenInit=300;
var nLanes_main=3;
var nLanes_onramp=1;
var laneWidth=7;
var laneWidthRamp=5;

var rampLenInit=1050; 
var mergeLen=60;
var taperLen=30;

// variable depending on aspect ratio: only relevant for graphics

var straightLen=0.34*mainroadLenInit;      // straight segments of U
var mainRampOffset=mainroadLenInit-straightLen+mergeLen-rampLenInit;
var arcLen=mainroadLenInit-2*straightLen; // length of half-circe arc of U
var arcRadius=arcLen/Math.PI;
var center_xPhys=95; // only IC!! later not relevant!
var center_yPhys=-110; // only IC!! ypixel downwards=> physical center <0

var rampRadius=4*arcRadius;

var sizePhys=200;  // typical physical linear dimension for scaling 



// specification of vehicle and traffic  properties

var car_length=7; // car length in m
var car_width=5; // car width in m
var truck_length=15; // trucks
var truck_width=7; 

// initial parameter settings (!! transfer def to GUI if variable in sliders!)
//!! clarify mandatory changes:
// (i) here: var MOBIL_mandat_bSafe=42 ...
// (ia) here: var LCModelMandatoryLeft=new MOBIL(MOBIL_mandat_bSafe,...)
// (1b) here: onramp.LCModelMandatoryLeft=LCModelMandatoryLeft
// (ii) road.js: road.mandat_bSafe=17
// (iia) road.js: this.LCModelMandatoryLeft=new MOBIL(17,0,-17/2) for diverges
//       (formulated with road.mandat_bSafe)
// (iii) function road.prototype.mergeDiverge: local variable merge_bSafe=road.mandat_bSafe
// (iv) longitudinal deceleration IDM.bmax=16

var MOBIL_bSafe=4;     // bSafe if v to v0
var MOBIL_bSafeMax=17; // bSafe if v to 0 //!! use it
var MOBIL_bThr=0.4;
var MOBIL_bBiasRight_car=-0.2; 
var MOBIL_bBiasRight_truck=0.1; 

var MOBIL_mandat_bSafe=42;
var MOBIL_mandat_bThr=0;
var MOBIL_mandat_bias=42;

var dt_LC=4; // duration of a lane change

// simulation initial conditions settings
//(initial values and range of user-ctrl var in gui.js)

var speedInit=20; // m/s
var densityInit=0.02;
var speedInitPerturb=13;
var relPosPerturb=0.8;
var truckFracToleratedMismatch=0.2; // open system: need tolerance, otherwise sudden changes


//############################################################################
// image file settings
//############################################################################


var car_srcFile='figs/blackCarCropped.gif';
var truck_srcFile='figs/truck1Small.png';
var obstacle_srcFile='figs/obstacleImg.png';
var road1lanes_srcFile='figs/road1lanesCrop.png';
var road2lanesWith_srcFile='figs/road2lanesCropWith.png';
var road3lanesWith_srcFile='figs/road3lanesCropWith.png';
var road4lanesWith_srcFile='figs/road4lanesCropWith.png';
var road2lanesWithout_srcFile='figs/road2lanesCropWithout.png';
var road3lanesWithout_srcFile='figs/road3lanesCropWithout.png';
var road4lanesWithout_srcFile='figs/road4lanesCropWithout.png';
var ramp_srcFile='figs/road1lanesCrop.png';

// Notice: set drawBackground=false if no bg wanted
var background_srcFile='figs/backgroundGrass.jpg'; 



//#################################
// Global graphics specification
//#################################

var canvas;
var ctx;  // graphics context
 
var background;
 



//###############################################################
// physical (m) road, vehicle and model specification
//###############################################################

// IDM_v0 etc and updateModels() with actions  "longModelCar=new ACC(..)" etc
// defined in gui.js

    // (1) define road geometry as parametric functions of arclength u
    // (physical coordinates!)

function traj_xInit(u){ // physical coordinates
        var dxPhysFromCenter= // left side (median), phys coordinates
	    (u<straightLen) ? straightLen-u
	  : (u>straightLen+arcLen) ? u-mainroadLenInit+straightLen
	  : -arcRadius*Math.sin((u-straightLen)/arcRadius);
	return center_xPhys+dxPhysFromCenter;
}

function traj_yInit(u){ // physical coordinates
        var dyPhysFromCenter=
 	    (u<straightLen) ? arcRadius
	  : (u>straightLen+arcLen) ? -arcRadius
	  : arcRadius*Math.cos((u-straightLen)/arcRadius);
	return center_yPhys+dyPhysFromCenter;
}


function trajRamp_xInit(u){ // physical coordinates
	//var xMergeBegin=traj_xInit(mainroadLenInit-straightLen);
	var xMergeBegin=traj_xInit(mainRampOffset+rampLenInit-mergeLen);
	var xPrelim=xMergeBegin+(u-(rampLenInit-mergeLen));
	return (u<rampLenInit-taperLen) 
	    ? xPrelim : xPrelim-0.05*(u-rampLenInit+taperLen);
}


//!! do not refer to mainroad or onramp!! may not be defined: 
// mainroad.nLanes => nLanes_main, onramp.nLanes=>nLanes_onramp1!!

function trajRamp_yInit(u){ // physical coordinates

    var yMergeBegin=traj_yInit(mainRampOffset+rampLenInit-mergeLen)
	-0.5*laneWidth*(nLanes_main+nLanes_onramp)-0.02*laneWidth;

    var yMergeEnd=yMergeBegin+laneWidth;
    return (u<rampLenInit-mergeLen)
	? yMergeBegin - 0.5*Math.pow(rampLenInit-mergeLen-u,2)/rampRadius
	: (u<rampLenInit-taperLen) ? yMergeBegin
	: (u<rampLenInit-0.5*taperLen) 
        ? yMergeBegin+2*laneWidth*Math.pow((u-rampLenInit+taperLen)/taperLen,2)
	: yMergeEnd - 2*laneWidth*Math.pow((u-rampLenInit)/taperLen,2);
}


console.log("main: trajRamp_xInit(rampLenInit)=",trajRamp_xInit(rampLenInit));

var longModelCar;
var longModelTruck;
var LCModelCar;
var LCModelTruck;
var LCModelMandatoryRight=new MOBIL(MOBIL_mandat_bSafe, MOBIL_mandat_bSafe, 
				    MOBIL_mandat_bThr, MOBIL_mandat_bias);
var LCModelMandatoryLeft=new MOBIL(MOBIL_mandat_bSafe, MOBIL_mandat_bSafe, 
				    MOBIL_mandat_bThr, -MOBIL_mandat_bias);
updateModels(); //  from onramp_gui.js 

var isRing=0;  // 0: false; 1: true
var roadIDmain=1;
var roadIDramp=2;
var mainroad=new road(roadIDmain,mainroadLenInit,laneWidth,nLanes_main,
		      traj_xInit,traj_yInit,
		      0.1*densityInit, speedInit,truckFracInit, isRing);
console.log("end define mainroad, before onramp");
var onramp=new road(roadIDramp,rampLenInit,laneWidth,1,
		    trajRamp_xInit,trajRamp_yInit,
		    0*densityInit, speedInit, truckFracInit, isRing);
if(false){	
    console.log("end define onramp:",
	    " trajRamp_xInit(rampLenInit)=", trajRamp_xInit(rampLenInit),
	    " onramp.traj_x(rampLenInit)=",onramp.traj_x(rampLenInit),
	    " onramp.xtab[onramp.nSegm]=",onramp.xtab[onramp.nSegm]);
}

onramp.LCModelMandatoryRight=LCModelMandatoryRight; //unique mandat LC model
onramp.LCModelMandatoryLeft=LCModelMandatoryLeft; //unique mandat LC model

//!! test Micro-IC (!! trucks may change to cars due to init truck frac)

if(false){
    types  =[0,    0,    1,    0];
    lengths=[8,    5,    14,   7];
    widths =[4.5,  4,    6,  4.5];
    longPos=[150,  160,  170,  180];
    lanes  =[0,    1,    2,    0];
    speeds =[25,   25,   0,   30];
    mainroad.initializeMicro(types,lengths,widths,longPos,lanes,speeds);
}

// add standing virtual vehicle at the end of onramp (1 lane)
// prepending=unshift (strange name)

var virtualStandingVeh=new vehicle(2, laneWidth, onramp.roadLen-0.6*taperLen, 0, 0, "obstacle");
var longModelObstacle=new ACC(0,IDM_T,IDM_s0,0,IDM_b);
var LCModelObstacle=new MOBIL(MOBIL_bSafe, MOBIL_bSafe,1000,MOBIL_bBiasRight_car);
virtualStandingVeh.longModel=longModelObstacle;
virtualStandingVeh.LCModel=LCModelObstacle;
onramp.veh.unshift(virtualStandingVeh);
if(false){
        console.log("\nonramp.nveh="+onramp.nveh);
	for(var i=0; i<onramp.veh.length; i++){
	    console.log("i="+i
			+" onramp.veh[i].type="+onramp.veh[i].type
			+" onramp.veh[i].u="+onramp.veh[i].u
			+" onramp.veh[i].v="+onramp.veh[i].v
			+" onramp.veh[i].lane="+onramp.veh[i].lane
			+" onramp.veh[i].laneOld="+onramp.veh[i].laneOld);
	}
	console.log("\n");
}




//############################################
// run-time specification and functions
//############################################

var time=0;
var itime=0;
var fps=30; // frames per second (unchanged during runtime)
var dt=timewarp/fps;


//#################################################################
function updateU(){
//#################################################################

    // update times

    time +=dt; // dt depends on timewarp slider (fps=const)
    itime++;

    // transfer effects from slider interaction 
    // and changed mandatory states to the vehicles and models 

    //console.log("\nbefore mainroad.writeVehicles:"); mainroad.writeVehicles();
    mainroad.updateTruckFrac(truckFrac, truckFracToleratedMismatch);
    mainroad.updateModelsOfAllVehicles(longModelCar,longModelTruck,
				       LCModelCar,LCModelTruck);

    //console.log("\nbefore onramp.writeVehicles:"); onramp.writeVehicles();
    onramp.updateTruckFrac(truckFrac, truckFracToleratedMismatch);
    onramp.updateModelsOfAllVehicles(longModelCar,longModelTruck,
				       LCModelCar,LCModelTruck);

    // externally impose mandatory LC behaviour
    // all onramp vehicles must change lanes to the left (last arg=false)
    onramp.setLCMandatory(0, onramp.roadLen, false);


    // do central simulation update of vehicles

    mainroad.updateLastLCtimes(dt);
    //console.log("1: mainroad.nveh=",mainroad.veh.length);
    mainroad.calcAccelerations();  
    mainroad.changeLanes();         
    //console.log("3: mainroad.nveh=",mainroad.veh.length);
    mainroad.updateSpeedPositions();
    mainroad.updateBCdown();
    //console.log("5: mainroad.nveh=",mainroad.veh.length);
    mainroad.updateBCup(qIn,dt); // argument=total inflow
    //console.log("6: mainroad.nveh=",mainroad.veh.length);

    if(true){
	for (var i=0; i<mainroad.nveh; i++){
	    if(mainroad.veh[i].speed<0){
		console.log(" speed "+mainroad.veh[i].speed
			    +" of mainroad vehicle "
			    +i+" is negative!");
	    }
	}
    }

    //console.log("1: onramp.nveh=",onramp.veh.length);
    onramp.calcAccelerations();  
    onramp.updateSpeedPositions();
    onramp.updateBCdown();
    //console.log("5: onramp.nveh=",onramp.veh.length);
    onramp.updateBCup(qOn,dt); // argument=total inflow
    //console.log("6: onramp.nveh=",onramp.veh.length);

    //template: mergeDiverge(newRoad,offset,uStart,uEnd,isMerge,toRight)

    if(false){
    console.log("\nbefore onramp.mergeDiverge:",
		" onramp.roadLen=", onramp.roadLen,
		" mainroad.roadLen=", mainroad.roadLen,
		" mainRampOffset=", mainRampOffset);
	console.log("  onramp.traj_x(onramp.roadLen)=",
		onramp.traj_x(onramp.roadLen));
	console.log("  mainroad.traj_x(onramp.roadLen+mainRampOffset)=",
		mainroad.traj_x(onramp.roadLen+mainRampOffset));
        console.log("  trajRamp__xInit(onramp.roadLen)=",
		trajRamp_xInit(onramp.roadLen));
        console.log("  traj_xInit(onramp.roadLen+mainRampOffset)=",
	        traj_xInit(onramp.roadLen+mainRampOffset));
    }

    onramp.mergeDiverge(mainroad,mainRampOffset,
			onramp.roadLen-mergeLen,onramp.roadLen,true,false);

    //logging

    if(false){
        console.log("\nafter updateU: itime="+itime+" mainroad.nveh="+mainroad.nveh);
	for(var i=0; i<mainroad.veh.length; i++){
	    console.log("i="+i+" mainroad.veh[i].u="+mainroad.veh[i].u
			+" mainroad.veh[i].v="+mainroad.veh[i].v
			+" mainroad.veh[i].lane="+mainroad.veh[i].lane
			+" mainroad.veh[i].laneOld="+mainroad.veh[i].laneOld);
	}
        console.log("\nonramp.nveh="+onramp.nveh);
	for(var i=0; i<onramp.veh.length; i++){
	    console.log("i="+i
			+" onramp.veh[i].type="+onramp.veh[i].type
			+" onramp.veh[i].u="+onramp.veh[i].u
			+" onramp.veh[i].v="+onramp.veh[i].v
			+" onramp.veh[i].speed="+onramp.veh[i].speed);
	}
	console.log("\n");
    }

}//updateU




//##################################################
function drawU() {
//##################################################

    //!! test relative motion isMoving
    var movingObserver=false;
    var uObs=0*time;

    /* (0) redefine graphical aspects of road (arc radius etc) using
     responsive design if canvas has been resized 
     (=actions of canvasresize.js for the ring-road scenario,
     here not usable ecause of side effects with sizePhys)
     NOTICE: resizing also brings some small traffic effects 
     because mainRampOffset slightly influenced, but No visible effect 
     */

    var critAspectRatio=1.15;
    var hasChanged=false;
    var simDivWindow=document.getElementById("contents");

    if (canvas.width!=simDivWindow.clientWidth){
	hasChanged=true;
	canvas.width  = simDivWindow.clientWidth;
    }
    if (canvas.height != simDivWindow.clientHeight){
	hasChanged=true;
        canvas.height  = simDivWindow.clientHeight;
    }
    var aspectRatio=canvas.width/canvas.height;
    var refSizePix=Math.min(canvas.height,canvas.width/critAspectRatio);

    //if(false){
    if(hasChanged){

      // update sliderWidth in *_gui.js; 

      var css_track_vmin=15; // take from sliders.css 
      sliderWidth=0.01*css_track_vmin*Math.min(canvas.width,canvas.height);

      // update geometric properties

      arcRadius=0.14*mainroadLenInit*Math.min(critAspectRatio/aspectRatio,1.);
      sizePhys=2.3*arcRadius + 2*nLanes_main*laneWidth;
      arcLen=arcRadius*Math.PI;
      straightLen=0.5*(mainroadLenInit-arcLen);  // one straight segment

      center_xPhys=1.4*arcRadius;
      center_yPhys=-1.35*arcRadius; // ypixel downwards=> physical center <0
      scale=refSizePix/sizePhys; 

      // !!! if hasChanged revert any user-dragged shifts!
      mainRampOffset=mainroadLenInit-straightLen+mergeLen-rampLenInit;

      mainroad.roadLen=mainroadLenInit;
      onramp.roadLen=rampLenInit;
      onramp.veh[0].u=onramp.roadLen-0.6*taperLen; // shift obstacle

      mainroad.gridTrajectories(traj_xInit,traj_yInit); //!!!!
      onramp.gridTrajectories(trajRamp_xInit,trajRamp_yInit);

      if(true){
	  console.log("\n after local canvas resize, after gridTrajectories:\n",
		      "mainroad.roadLen=",mainroad.roadLen,
		      "onramp.roadLen=",onramp.roadLen,
                    " trajRamp_xInit(rampLenInit)=", trajRamp_xInit(rampLenInit),
	            " onramp.traj_x(rampLenInit)=",onramp.traj_x(rampLenInit),
	            " onramp.traj_x(onramp.roadLen)=",onramp.traj_x(onramp.roadLen),
	            " onramp.xtab[onramp.nSegm]=",onramp.xtab[onramp.nSegm]
		   );
      }



    }



    // (1) update heading of all vehicles rel. to road axis
    // (for some reason, strange rotations at beginning)

    mainroad.updateOrientation(); 



    // (2) reset transform matrix and draw background
    // (only needed if no explicit road drawn)

    ctx.setTransform(1,0,0,1,0,0); 
    if(drawBackground){
	if(hasChanged||(itime<=2) || (itime==20) || changedRoadGeometry 
	   || movingObserver || (!drawRoad)){
        ctx.drawImage(background,0,0,canvas.width,canvas.height);
      }
    }

    // (3) draw mainroad and ramp
    // (always drawn; changedGeometry only triggers building a new lookup table)

    var changedGeometry=changedRoadGeometry || hasChanged||(itime<=1)||true; 
    onramp.draw(rampImg,rampImg,scale,changedGeometry,
		movingObserver,0, 
		center_xPhys-mainroad.traj_x(uObs)+onramp.traj_x(0),
		center_yPhys-mainroad.traj_y(uObs)+onramp.traj_y(0)); 

    mainroad.draw(roadImg1,roadImg2,scale,changedGeometry,
		  movingObserver,uObs,center_xPhys,center_yPhys); 

// center_xPhys, center_yPhys
 
    // (4) draw vehicles

    onramp.drawVehicles(carImg,truckImg,obstacleImg,scale,
			vmin,vmax,0,onramp.roadLen,
			movingObserver,0,
			center_xPhys-mainroad.traj_x(uObs)+onramp.traj_x(0),
			center_yPhys-mainroad.traj_y(uObs)+onramp.traj_y(0));


    mainroad.drawVehicles(carImg,truckImg,obstacleImg,scale,
			  vmin, vmax,0,mainroad.roadLen,
			  movingObserver,uObs,center_xPhys,center_yPhys);



    // (5) draw some running-time vars

  if(false){
    ctx.setTransform(1,0,0,1,0,0); 
    var textsize=0.02*Math.min(canvas.width,canvas.height); // 2vw;
    ctx.font=textsize+'px Arial';

    var timeStr="Time="+Math.round(10*time)/10;
    var timeStr_xlb=textsize;

    var timeStr_ylb=1.8*textsize;
    var timeStr_width=6*textsize;
    var timeStr_height=1.2*textsize;

    ctx.fillStyle="rgb(255,255,255)";
    ctx.fillRect(timeStr_xlb,timeStr_ylb-timeStr_height,
		 timeStr_width,timeStr_height);
    ctx.fillStyle="rgb(0,0,0)";
    ctx.fillText(timeStr, timeStr_xlb+0.2*textsize,
		 timeStr_ylb-0.2*textsize);

    
   /*
    var scaleStr=" scale="+Math.round(10*scale)/10;
    var scaleStr_xlb=9*textsize;
    var scaleStr_ylb=timeStr_ylb;
    var scaleStr_width=5*textsize;
    var scaleStr_height=1.2*textsize;
    ctx.fillStyle="rgb(255,255,255)";
    ctx.fillRect(scaleStr_xlb,scaleStr_ylb-scaleStr_height,
		 scaleStr_width,scaleStr_height);
    ctx.fillStyle="rgb(0,0,0)";
    ctx.fillText(scaleStr, scaleStr_xlb+0.2*textsize, 
		 scaleStr_ylb-0.2*textsize);
    
    var timewStr="timewarp="+Math.round(10*timewarp)/10;
    var timewStr_xlb=15*textsize;
    var timewStr_ylb=timeStr_ylb;
    var timewStr_width=7*textsize;
    var timewStr_height=1.2*textsize;
    ctx.fillStyle="rgb(255,255,255)";
    ctx.fillRect(timewStr_xlb,timewStr_ylb-timewStr_height,
		 timewStr_width,timewStr_height);
    ctx.fillStyle="rgb(0,0,0)";
    ctx.fillText(timewStr, timewStr_xlb+0.2*textsize,
		 timewStr_ylb-0.2*textsize);


    var genVarStr="truckFrac="+Math.round(100*truckFrac)+"\%";
    var genVarStr_xlb=24*textsize;
    var genVarStr_ylb=timeStr_ylb;
    var genVarStr_width=7.2*textsize;
    var genVarStr_height=1.2*textsize;
    ctx.fillStyle="rgb(255,255,255)";
    ctx.fillRect(genVarStr_xlb,genVarStr_ylb-genVarStr_height,
		 genVarStr_width,genVarStr_height);
    ctx.fillStyle="rgb(0,0,0)";
    ctx.fillText(genVarStr, genVarStr_xlb+0.2*textsize, 
		 genVarStr_ylb-0.2*textsize);
    

    var genVarStr="qIn="+Math.round(3600*qIn)+"veh/h";
    var genVarStr_xlb=32*textsize;
    var genVarStr_ylb=timeStr_ylb;
    var genVarStr_width=7.2*textsize;
    var genVarStr_height=1.2*textsize;
    ctx.fillStyle="rgb(255,255,255)";
    ctx.fillRect(genVarStr_xlb,genVarStr_ylb-genVarStr_height,
		 genVarStr_width,genVarStr_height);
    ctx.fillStyle="rgb(0,0,0)";
    ctx.fillText(genVarStr, genVarStr_xlb+0.2*textsize, 
		 genVarStr_ylb-0.2*textsize);
*/


    // (6) draw the speed colormap

    if(drawColormap){
      displayColormap(0.22*refSizePix,
                   0.43*refSizePix,
                   0.1*refSizePix, 0.2*refSizePix,
		   vmin,vmax,0,100/3.6);
    }
    // revert to neutral transformation at the end!
    ctx.setTransform(1,0,0,1,0,0); 
  }
}
 




function init() {

    // get overall dimensions from parent html page
    // "canvas_onramp" defined in onramp.html

    canvas = document.getElementById("canvas_onramp"); 
    ctx = canvas.getContext("2d");
 
    width  = canvas.width;   // pixel coordinates (DOS)
    height = canvas.height;  // DOS


    // init background image

    background = new Image();
    background.src =background_srcFile;

    // init vehicle image(s)

    carImg = new Image();
    carImg.src = car_srcFile;
    truckImg = new Image();
    truckImg.src = truck_srcFile;
    obstacleImg = new Image();
    obstacleImg.src = obstacle_srcFile;

    // init road image(s)

    roadImg1 = new Image();
    roadImg1.src=(nLanes_main==1)
	? road1lanes_srcFile
	: (nLanes_main==2) ? road2lanesWith_srcFile
	: (nLanes_main==3) ? road3lanesWith_srcFile
	: road4lanesWith_srcFile;

    roadImg2 = new Image();
    roadImg2.src=(nLanes_main==1)
	? road1lanes_srcFile
	: (nLanes_main==2) ? road2lanesWithout_srcFile
	: (nLanes_main==3) ? road3lanesWithout_srcFile
	: road4lanesWithout_srcFile;

    rampImg = new Image();
    rampImg.src=ramp_srcFile;


    // starts simulation thread "main_loop" (defined below) 
    // with update time interval 1000/fps milliseconds

    return setInterval(main_loop, 1000/fps); 
} // end init()




//##################################################
// Running function of the sim thread (triggered by setInterval)
//##################################################

function main_loop() {
    updateU();
    drawU();
}
 

//##################################################
// Actual start of the simulation thread
// (also started from gui.js "Onramp" button) 
//##################################################

 
 var myRun=init(); //if start with onramp: init, starts thread "main_loop" 
