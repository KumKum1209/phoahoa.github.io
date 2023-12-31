// when animating on canvas, it is best to use requestAnimationFrame instead of setTimeout or setInterval
// not supported in all browsers though and sometimes needs a prefix, so we need a shim
window.requestAnimFrame = ( function() {
	return window.requestAnimationFrame ||
				window.webkitRequestAnimationFrame ||
				window.mozRequestAnimationFrame ||
				function( callback ) {
					window.setTimeout( callback, 1000 / 60 );
				};
})();

// now we will setup our basic variables for the demo
var canvas = document.getElementById( 'canvas' ),
		ctx = canvas.getContext( '2d' ),
		// full screen dimensions
		cw = window.innerWidth,
		ch = window.innerHeight,
		// firework collection
		fireworks = [],
		// particle collection
		particles = [],
		// starting hue
		hue = 120,
		// when launching fireworks with a click, too many get launched at once without a limiter, one launch per 5 loop ticks
		limiterTotal = 5,
		limiterTick = 0,
		// this will time the auto launches of fireworks, one launch per 80 loop ticks
		timerTotal = 80,
		timerTick = 0,
		mousedown = false,
		// mouse x coordinate,
		mx,
		// mouse y coordinate
		my;
		
// set canvas dimensions
canvas.width = cw;
canvas.height = ch;

// now we are going to setup our function placeholders for the entire demo

// get a random number within a range
function random( min, max ) {
	return Math.random() * ( max - min ) + min;
}

// calculate the distance between two points
function calculateDistance( p1x, p1y, p2x, p2y ) {
	var xDistance = p1x - p2x,
			yDistance = p1y - p2y;
	return Math.sqrt( Math.pow( xDistance, 2 ) + Math.pow( yDistance, 2 ) );
}

// create firework
function Firework( sx, sy, tx, ty ) {
	// actual coordinates
	this.x = sx;
	this.y = sy;
	// starting coordinates
	this.sx = sx;
	this.sy = sy;
	// target coordinates
	this.tx = tx;
	this.ty = ty;
	// distance from starting point to target
	this.distanceToTarget = calculateDistance( sx, sy, tx, ty );
	this.distanceTraveled = 0;
	// track the past coordinates of each firework to create a trail effect, increase the coordinate count to create more prominent trails
	this.coordinates = [];
	this.coordinateCount = 3;
	// populate initial coordinate collection with the current coordinates
	while( this.coordinateCount-- ) {
		this.coordinates.push( [ this.x, this.y ] );
	}
	this.angle = Math.atan2( ty - sy, tx - sx );
	this.speed = 2;
	this.acceleration = 1.05;
	this.brightness = random( 50, 70 );
	// circle target indicator radius
	this.targetRadius = 1;
}

// update firework
Firework.prototype.update = function( index ) {
	// remove last item in coordinates array
	this.coordinates.pop();
	// add current coordinates to the start of the array
	this.coordinates.unshift( [ this.x, this.y ] );
	
	// cycle the circle target indicator radius
	if( this.targetRadius < 8 ) {
		this.targetRadius += 0.3;
	} else {
		this.targetRadius = 1;
	}
	
	// speed up the firework
	this.speed *= this.acceleration;
	
	// get the current velocities based on angle and speed
	var vx = Math.cos( this.angle ) * this.speed,
			vy = Math.sin( this.angle ) * this.speed;
	// how far will the firework have traveled with velocities applied?
	this.distanceTraveled = calculateDistance( this.sx, this.sy, this.x + vx, this.y + vy );
	
	// if the distance traveled, including velocities, is greater than the initial distance to the target, then the target has been reached
	if( this.distanceTraveled >= this.distanceToTarget ) {
		createParticles( this.tx, this.ty );
		// remove the firework, use the index passed into the update function to determine which to remove
		fireworks.splice( index, 1 );
	} else {
		// target not reached, keep traveling
		this.x += vx;
		this.y += vy;
	}
}

// draw firework
Firework.prototype.draw = function() {
	ctx.beginPath();
	// move to the last tracked coordinate in the set, then draw a line to the current x and y
	ctx.moveTo( this.coordinates[ this.coordinates.length - 1][ 0 ], this.coordinates[ this.coordinates.length - 1][ 1 ] );
	ctx.lineTo( this.x, this.y );
	ctx.strokeStyle = 'hsl(' + hue + ', 100%, ' + this.brightness + '%)';
	ctx.stroke();
	
	ctx.beginPath();
	// draw the target for this firework with a pulsing circle
	ctx.arc( this.tx, this.ty, this.targetRadius, 0, Math.PI * 2 );
	ctx.stroke();
}

// create particle
function Particle( x, y ) {
	this.x = x;
	this.y = y;
	// track the past coordinates of each particle to create a trail effect, increase the coordinate count to create more prominent trails
	this.coordinates = [];
	this.coordinateCount = 5;
	while( this.coordinateCount-- ) {
		this.coordinates.push( [ this.x, this.y ] );
	}
	// set a random angle in all possible directions, in radians
	this.angle = random( 0, Math.PI * 2 );
	this.speed = random( 1, 10 );
	// friction will slow the particle down
	this.friction = 0.95;
	// gravity will be applied and pull the particle down
	this.gravity = 1;
	// set the hue to a random number +-20 of the overall hue variable
	this.hue = random( hue - 20, hue + 20 );
	this.brightness = random( 50, 80 );
	this.alpha = 1;
	// set how fast the particle fades out
	this.decay = random( 0.015, 0.03 );
}

// update particle
Particle.prototype.update = function( index ) {
	// remove last item in coordinates array
	this.coordinates.pop();
	// add current coordinates to the start of the array
	this.coordinates.unshift( [ this.x, this.y ] );
	// slow down the particle
	this.speed *= this.friction;
	// apply velocity
	this.x += Math.cos( this.angle ) * this.speed;
	this.y += Math.sin( this.angle ) * this.speed + this.gravity;
	// fade out the particle
	this.alpha -= this.decay;
	
	// remove the particle once the alpha is low enough, based on the passed in index
	if( this.alpha <= this.decay ) {
		particles.splice( index, 1 );
	}
}

// draw particle
Particle.prototype.draw = function() {
	ctx. beginPath();
	// move to the last tracked coordinates in the set, then draw a line to the current x and y
	ctx.moveTo( this.coordinates[ this.coordinates.length - 1 ][ 0 ], this.coordinates[ this.coordinates.length - 1 ][ 1 ] );
	ctx.lineTo( this.x, this.y );
	ctx.strokeStyle = 'hsla(' + this.hue + ', 100%, ' + this.brightness + '%, ' + this.alpha + ')';
	ctx.stroke();
}

// create particle group/explosion
function createParticles( x, y ) {
	// increase the particle count for a bigger explosion, beware of the canvas performance hit with the increased particles though
	var particleCount = 30;
	while( particleCount-- ) {
		particles.push( new Particle( x, y ) );
	}
}

// main demo loop
function loop() {
	// this function will run endlessly with requestAnimationFrame
	requestAnimFrame( loop );
	
	// increase the hue to get different colored fireworks over time
	hue += 0.5;
	
	// normally, clearRect() would be used to clear the canvas
	// we want to create a trailing effect though
	// setting the composite operation to destination-out will allow us to clear the canvas at a specific opacity, rather than wiping it entirely
	ctx.globalCompositeOperation = 'destination-out';
	// decrease the alpha property to create more prominent trails
	ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
	ctx.fillRect( 0, 0, cw, ch );
	// change the composite operation back to our main mode
	// lighter creates bright highlight points as the fireworks and particles overlap each other
	ctx.globalCompositeOperation = 'lighter';
	
	// loop over each firework, draw it, update it
	var i = fireworks.length;
	while( i-- ) {
		fireworks[ i ].draw();
		fireworks[ i ].update( i );
	}
	
	// loop over each particle, draw it, update it
	var i = particles.length;
	while( i-- ) {
		particles[ i ].draw();
		particles[ i ].update( i );
	}
	
	// launch fireworks automatically to random coordinates, when the mouse isn't down
	if( timerTick >= timerTotal ) {
		if( !mousedown ) {
			// start the firework at the bottom middle of the screen, then set the random target coordinates, the random y coordinates will be set within the range of the top half of the screen
			fireworks.push( new Firework( cw / 2, ch, random( 0, cw ), random( 0, ch / 2 ) ) );
			timerTick = 0;
		}
	} else {
		timerTick++;
	}
	
	// limit the rate at which fireworks get launched when mouse is down
	if( limiterTick >= limiterTotal ) {
		if( mousedown ) {
			// start the firework at the bottom middle of the screen, then set the current mouse coordinates as the target
			fireworks.push( new Firework( cw / 2, ch, mx, my ) );
			limiterTick = 0;
		}
	} else {
		limiterTick++;
	}
}

// mouse event bindings
// update the mouse coordinates on mousemove
canvas.addEventListener( 'mousemove', function( e ) {
	mx = e.pageX - canvas.offsetLeft;
	my = e.pageY - canvas.offsetTop;
});

// toggle mousedown state and prevent canvas from being selected
canvas.addEventListener( 'mousedown', function( e ) {
	e.preventDefault();
	mousedown = true;
});

canvas.addEventListener( 'mouseup', function( e ) {
	e.preventDefault();
	mousedown = false;
});

//// once the window loads, we are ready for some fireworks!
//window.onload = loop;
//"use strict";
//// Inspired By
//// https://codepen.io/abeatrize/pen/LJqYey
//var _a, _b;
//// Bongo Cat originally created by @StrayRogue and @DitzyFlama
//const ID = "bongo-cat";
//const s = (selector) => `#${ID} ${selector}`;
//const notes = document.querySelectorAll(".note");
//for (let note of notes) {
//	(_a = note === null || note === void 0 ? void 0 : note.parentElement) === null || _a === void 0 ? void 0 : _a.appendChild(note.cloneNode(true));
//	(_b = note === null || note === void 0 ? void 0 : note.parentElement) === null || _b === void 0 ? void 0 : _b.appendChild(note.cloneNode(true));
//}
//const music = { note: s(".music .note") };
//const cat = {
//	pawRight: {
//		up: s(".paw-right .up"),
//		down: s(".paw-right .down"),
//	},
//	pawLeft: {
//		up: s(".paw-left .up"),
//		down: s(".paw-left .down"),
//	},
//};
//const style = getComputedStyle(document.documentElement);
//const green = style.getPropertyValue("--green");
//const pink = style.getPropertyValue("--pink");
//const blue = style.getPropertyValue("--blue");
//const orange = style.getPropertyValue("--orange");
//const cyan = style.getPropertyValue("--cyan");
//gsap.set(music.note, { scale: 0, autoAlpha: 1 });
//const animatePawState = (selector) => gsap.fromTo(selector, { autoAlpha: 0 }, {
//	autoAlpha: 1,
//	duration: 0.01,
//	repeatDelay: 0.19,
//	yoyo: true,
//	repeat: -1,
//});
//const tl = gsap.timeline();
//tl.add(animatePawState(cat.pawLeft.up), "start")
//	.add(animatePawState(cat.pawRight.down), "start")
//	.add(animatePawState(cat.pawLeft.down), "start+=0.19")
//	.add(animatePawState(cat.pawRight.up), "start+=0.19")
//	.timeScale(1.6);
//gsap.from(".terminal-code line", {
//	drawSVG: "0%",
//	duration: 0.1,
//	stagger: 0.1,
//	ease: "none",
//	repeat: -1,
//});
//// typing for pipe function doesn't seem to be working for usage when partially applied?
//const noteElFn = gsap.utils.pipe(gsap.utils.toArray, gsap.utils.shuffle);
//const noteEls = noteElFn(music.note);
//const numNotes = noteEls.length / 3;
//const notesG1 = noteEls.splice(0, numNotes);
//const notesG2 = noteEls.splice(0, numNotes);
//const notesG3 = noteEls;
//const colorizer = gsap.utils.random([green, pink, blue, orange, cyan, "#a3a4ec", "#67b5c0", "#fd7c6e"], true);
//const rotator = gsap.utils.random(-50, 50, 1, true);
//const dir = (amt) => `${gsap.utils.random(["-", "+"])}=${amt}`;
//const animateNotes = (els) => {
//	els.forEach((el) => {
//		gsap.set(el, {
//			stroke: colorizer(),
//			rotation: rotator(),
//			x: gsap.utils.random(-25, 25, 1),
//		});
//	});
//	return gsap.fromTo(els, {
//		autoAlpha: 1,
//		y: 0,
//		scale: 0,
//	}, {
//		duration: 2,
//		autoAlpha: 0,
//		scale: 1,
//		ease: "none",
//		stagger: {
//			from: "random",
//			each: 0.5,
//		},
//		rotation: dir(gsap.utils.random(20, 30, 1)),
//		x: dir(gsap.utils.random(40, 60, 1)),
//		y: gsap.utils.random(-200, -220, 1),
//		onComplete: () => animateNotes(els),
//	});
//};
//tl.add(animateNotes(notesG1)).add(animateNotes(notesG2), ">0.05").add(animateNotes(notesG3), ">0.25");

//document.addEventListener("click", function () {
//	window.location = "./main.html";
//});

////countdown

//(function () {
//	var animation = {
//		newYear: document.querySelector(".new-year"),
//		range: function (min, max) {
//			return Math.floor(Math.random() * (max - min + 1) + min);
//		},
//		get period() {
//			var dateFuture = new Date(new Date().getFullYear() + 1, 0, 1);
//			var dateNow = new Date();
//			var seconds = Math.floor((dateFuture - (dateNow)) / 1000);
//			var minutes = Math.floor(seconds / 60);
//			var hours = Math.floor(minutes / 60);
//			var days = Math.floor(hours / 24);
//			hours = hours - (days * 24);
//			minutes = minutes - (days * 24 * 60) - (hours * 60);
//			seconds = seconds - (days * 24 * 60 * 60) - (hours * 60 * 60) - (minutes * 60);
//			return {
//				year: new Date().getFullYear() + 1,
//				days: days,
//				hours: hours,
//				minutes: minutes,
//				seconds: seconds
//			}
//		},
//		element: function (parent, type, className, html) {
//			var element = document.createElement(type);
//			element.className = className;
//			if (typeof html !== "undefined") element.innerHTML = html;
//			parent.appendChild(element);
//			return element;
//		},
//		year: function (className) {
//			var timeline = new TimelineMax();
//			var year = animation.element(animation.newYear, "div", className);
//			for (var i = 0; i <= String(animation.period.year).length - 1; i++) {
//				var digit = animation.element(year, "div", "digit", String(animation.period.year).substr(i, 1));
//				digit.style.top = (0 - (digit.clientHeight * 2)) + "px";
//				timeline
//					.to(digit, 0.5, { top: 0, opacity: 1, ease: Bounce.easeOut });
//			}
//			return year;
//		},
//		animate: function () {
//			var year1 = animation.year("year year1");
//			var controls = animation.element(animation.newYear, "div", "controls");
//			var days = animation.element(controls, "div", "control days");
//			var hours = animation.element(controls, "div", "control hours");
//			var minutes = animation.element(controls, "div", "control minutes");
//			var seconds = animation.element(controls, "div", "control seconds");
//			animation.controls = {
//				controls: controls,
//				days: days,
//				hours: hours,
//				minutes: minutes,
//				seconds: seconds
//			};
//			animation.render();
//			var triangles = animation.element(year1, "div", "triangles");
//			var fullTimeline = new TimelineMax();
//			var triangleStorage = [];
//			for (var i = 0; i <= 50 - 1; i++) {
//				var timeline = new TimelineMax({ repeat: -1 });
//				var triangle = animation.element(triangles, "div", "triangle");
//				triangle.style.top = -50 + "px";
//				var time = animation.range(0, 100) / 100;
//				var duration = 1;
//				var direction = animation.range(1, 2) == 1 ? -1 : 1;
//				timeline
//					.set(triangle, { scale: animation.range(10, 20) / 10 }, time)
//					.to(triangle, duration * 0.5, { opacity: 1 }, time)
//					.to(triangle, duration, { top: "200%", rotationZ: animation.range(180, 360) * direction, rotationX: animation.range(180, 360) * direction }, time)
//					.to(triangle, duration * 0.5, { opacity: 0 }, time + (duration * 0.5));
//				fullTimeline.add(timeline, 0);
//				triangleStorage.push(triangle);
//			}
//			var previousWidth = 0;
//			var checkWidth = function () {
//				if (Math.abs(previousWidth - year1.clientWidth) > 1) {
//					for (var i = 0; i <= triangleStorage.length - 1; i++) {
//						triangleStorage[i].style.left = (-5 + animation.range(0, year1.clientWidth)) + "px";
//					}
//					previousWidth = year1.clientWidth;
//				}
//				setTimeout(checkWidth, 100);
//			}
//			checkWidth();
//			return new TimelineMax()
//				.to(days, 0.5, { top: 0, opacity: 1 }, 0)
//				.to(hours, 0.5, { top: 0, opacity: 1 }, 0.25)
//				.to(minutes, 0.5, { top: 0, opacity: 1 }, 0.5)
//				.to(seconds, 0.5, { top: 0, opacity: 1 }, 0.75)
//				.set(triangles, { opacity: 1 }, 3)
//				.add(fullTimeline, 3);
//		},
//		plural: function (property) {
//			var period = animation.period;
//			if (String(period[property]).length <= 1) period[property] = "0" + period[property];
//			return Number(period[property]) > 1 ? period[property] + " " + property : period[property] + " " + property.substr(0, property.length - 1);
//		},
//		render: function () {
//			animation.controls.seconds.innerHTML = animation.plural("seconds");
//			animation.controls.minutes.innerHTML = animation.plural("minutes");
//			animation.controls.hours.innerHTML = animation.plural("hours");
//			animation.controls.days.innerHTML = animation.plural("days");
//			requestAnimationFrame(animation.render);
//		}
//	};
//	animation.animate();
//})();