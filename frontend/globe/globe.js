/**
 * dat.globe Javascript WebGL Globe Toolkit
 * https://github.com/dataarts/webgl-globe
 *
 * Copyright 2011 Data Arts Team, Google Creative Lab
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 */

var DAT = DAT || {};

DAT.Globe = function(container, opts) {
    opts = opts || {};

    var colorFn = opts.colorFn || function(x) {
        var c = new THREE.Color();
        c.setHSL( ( 0.6 - ( x * 0.5 ) ), 1.0, 0.5 );
        return c;
    };
    var imgDir = opts.imgDir || './';

    var Shaders = {
        'earth' : {
            uniforms: {
                'texture': { type: 't', value: null }
            },
            vertexShader: [
                'varying vec3 vNormal;',
                'varying vec2 vUv;',
                'void main() {',
                'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
                'vNormal = normalize( normalMatrix * normal );',
                'vUv = uv;',
                '}'
            ].join('\n'),
            fragmentShader: [
                'uniform sampler2D texture;',
                'varying vec3 vNormal;',
                'varying vec2 vUv;',
                'void main() {',
                'vec3 diffuse = texture2D( texture, vUv ).xyz;',
                'float intensity = 1.05 - dot( vNormal, vec3( 0.0, 0.0, 1.0 ) );',
                'vec3 atmosphere = vec3( 1.0, 1.0, 1.0 ) * pow( intensity, 3.0 );',
                'gl_FragColor = vec4( diffuse + atmosphere, 1.0 );',
                '}'
            ].join('\n')
        },
        'atmosphere' : {
            uniforms: {},
            vertexShader: [
                'varying vec3 vNormal;',
                'void main() {',
                'vNormal = normalize( normalMatrix * normal );',
                'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
                '}'
            ].join('\n'),
            fragmentShader: [
                'varying vec3 vNormal;',
                'void main() {',
                'float intensity = pow( 0.8 - dot( vNormal, vec3( 0, 0, 1.0 ) ), 12.0 );',
                'gl_FragColor = vec4( 1.0, 1.0, 1.0, 1.0 ) * intensity;',
                '}'
            ].join('\n')
        }
    };

    var camera, scene, renderer, w, h;
    var mesh, atmosphere, point;

    var overRenderer;

    var curZoomSpeed = 0;
    var mouseSpeed = 10; // From 1 to 10.
    var zoomSpeed = 50;

    var mouse = { x: 0, y: 0 }, mouseOnDown = { x: 0, y: 0 };
    var rotation = { x: 0, y: 0 },
        target = { x: Math.PI*3/2, y: Math.PI / 6.0 },
        targetOnDown = { x: 0, y: 0 };

    var distance = 100000, distanceTarget = 100000;
    var padding = 40;
    var PI_HALF = Math.PI / 2;

    var point_size = 0.7;

    var raycaster, intersects, INTERSECTED;

    var prevPoint, prevColors, prevInter = null;

    function init() {

        container.style.color = '#fff';
        container.style.font = '13px/20px Arial, sans-serif';

        var shader, uniforms, material;
        w = container.offsetWidth || window.innerWidth;
        h = container.offsetHeight || window.innerHeight;

        camera = new THREE.PerspectiveCamera(30, w / h, 1, 10000);
        camera.position.z = distance;

        scene = new THREE.Scene();

        var geometry = new THREE.SphereGeometry(200, 40, 60);

        shader = Shaders['earth'];
        uniforms = THREE.UniformsUtils.clone(shader.uniforms);

        uniforms['texture'].value = THREE.ImageUtils.loadTexture(imgDir+'world.jpg');

        material = new THREE.ShaderMaterial({

            uniforms: uniforms,
            vertexShader: shader.vertexShader,
            fragmentShader: shader.fragmentShader

        });

        globeMesh = new THREE.Mesh(geometry, material);
        globeMesh.rotation.y = Math.PI;
        scene.add(globeMesh);

        var material = new THREE.MeshStandardMaterial({ color: "#202020", transparent: true, side: THREE.DoubleSide, alphaTest: 0.5 });
        var alphaMap = new THREE.TextureLoader().load(imgDir+'worldEdges.png');
        material.alphaMap = alphaMap;
        globeEdgeMesh = new THREE.Mesh(geometry, material);
        globeEdgeMesh.rotation.y = Math.PI;
        globeEdgeMesh.scale.set( 1.003, 1.003, 1.003);
        scene.add(globeEdgeMesh);

        shader = Shaders['atmosphere'];
        uniforms = THREE.UniformsUtils.clone(shader.uniforms);

        material = new THREE.ShaderMaterial({

            uniforms: uniforms,
            vertexShader: shader.vertexShader,
            fragmentShader: shader.fragmentShader,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            transparent: true

        });

        mesh = new THREE.Mesh(geometry, material);
        mesh.scale.set( 1.1, 1.1, 1.1 );
        scene.add(mesh);

        geometry = new THREE.CylinderBufferGeometry( point_size, point_size, 0.1, 6);
        geometry.applyMatrix( new THREE.Matrix4().makeRotationX( THREE.Math.degToRad( 90 ) ) );
        geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0,0,-0.5));

        point = new THREE.Mesh(geometry);

        renderer = new THREE.WebGLRenderer({antialias: true});
        renderer.setSize(w, h);
        renderer.setClearColor (0xEEEEEE, 1);
        renderer.domElement.style.position = 'absolute';

        container.appendChild(renderer.domElement);

        container.addEventListener('mousedown', onMouseDown, false);

        container.addEventListener('mousewheel', onMouseWheel, false);

        document.addEventListener('keydown', onDocumentKeyDown, false);

        // Pop-up raycaster event.
        document.addEventListener('mousemove', onDocumentMouseMove, false);

        window.addEventListener('resize', onWindowResize, false);

        container.addEventListener('mouseover', function() {
            overRenderer = true;
        }, false);

        container.addEventListener('mouseout', function() {
            overRenderer = false;
        }, false);

    }

    function onDocumentMouseMove(event) {
        // the following line would stop any other event handler from firing
        // (such as the mouse's TrackballControls)
        // event.preventDefault();

        // update the mouse variable
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    // function addData(data, opts) {
    //
    //
    //     var lat, lng, size, color, i, step, colorFnWrapper;
    //
    //     opts.animated = opts.animated || false;
    //     this.is_animated = opts.animated;
    //     opts.format = opts.format || 'magnitude'; // other option is 'legend'
    //     if (opts.format === 'magnitude') {
    //         step = 3;
    //         // colorFnWrapper = function(data, i) { return colorFn((data[i+2] - 200) / 290);}
    //     } else if (opts.format === 'legend') {
    //         step = 4;
    //         colorFnWrapper = function(data, i) { return colorFn(data[i+2]); }
    //     } else {
    //         throw('error: format not supported: '+opts.format);
    //     }
    //
    //
    //     // subgeo = new THREE.Geometry();
    //
    //     lat = data[0];
    //     lng = data[1];
    //     // color = colorFnWrapper(data,0);
    //     color = 0;
    //     size = 0.2;
    //     // subgeo.pointData = { 'lat' : data[0], 'lng' : data[1], 'int' : data[2] };
    //     addPoint(lat, lng, size, color, subgeo);
    //     if (opts.animated) {
    //         this._baseGeometry.morphTargets.push({'name': opts.name, vertices: subgeo.vertices});
    //     } else {
    //         this._baseGeometry = subgeo;
    //     }
    //
    // }

    // function createPoints() {
    //     if (this._baseGeometry !== undefined) {
    //         if (this.is_animated === false) {
    //             this.points = new THREE.Mesh(this._baseGeometry, new THREE.MeshBasicMaterial({
    //                 color: 0xffffff,
    //                 vertexColors: THREE.FaceColors,
    //                 morphTargets: false
    //             }));
    //         } else {
    //             if (this._baseGeometry.morphTargets.length < 8) {
    //                 var padding = 8-this._baseGeometry.morphTargets.length;
    //                 for(var i=0; i<=padding; i++) {
    //                     this._baseGeometry.morphTargets.push({'name': 'morphPadding'+i, vertices: this._baseGeometry.vertices});
    //                 }
    //             }
    //             // this.points = new THREE.Mesh(this._baseGeometry, new THREE.MeshBasicMaterial({
    //             //     color: 0xffffff,
    //             //     vertexColors: THREE.FaceColors,
    //             //     morphTargets: true
    //             // }));
    //         }
    //         // scene.add(this.points);
    //     }
    // }
    //
    // function addPoint(lat, lng, size, color, subgeo) {
    //
    //     var phi = (90 - lat) * Math.PI / 180;
    //     var theta = (180 - lng) * Math.PI / 180;
    //
    //     point.position.x = 200 * Math.sin(phi) * Math.cos(theta);
    //     point.position.y = 200 * Math.cos(phi);
    //     point.position.z = 200 * Math.sin(phi) * Math.sin(theta);
    //
    //     point.lookAt(mesh.position);
    //
    //     point.scale.z = Math.max( size, 0.1 ); // avoid non-invertible matrix
    //     point.updateMatrix();
    //
    //     // for (var i = 0; i < point.geometry.faces.length; i++) {
    //     //
    //     //     point.geometry.faces[i].color = color;
    //     //
    //     // }
    //     if(point.matrixAutoUpdate){
    //         point.updateMatrix();
    //     }
    // }

    function addDataPoints(data) {

        var colorFn = function(x) {
            var c = new THREE.Color();
            c.setHSL( ( 0.6 - ( x * 0.5 ) ), 1.0, 0.5 );
            return c;
        };

        var geometry = new THREE.Geometry();
        var material = new THREE.PointsMaterial( { size: 5,  vertexColors: THREE.VertexColors } );
        geometry.dat = [];

        for (var i = 0; i < data.length; i++) {
            for (var j = 0; j < data[i].data.length; j++) {

                dataPoint = [].concat.apply([], data[i].data[j]);

                lat = dataPoint[0];
                lng = dataPoint[1];

                // console.log((dataPoint[2] - 200) / 300);

                var phi   = (90  - lat) * Math.PI / 180;
                var theta = (180 - lng) * Math.PI / 180;

                var vertex   = new THREE.Vector3();

                vertex.x = 200.4 * Math.sin(phi) * Math.cos(theta);
                vertex.y = 200.4 * Math.cos(phi);
                vertex.z = 200.4 * Math.sin(phi) * Math.sin(theta);

                colors = colorFn((dataPoint[2] - 200) / 300);

                geometry.vertices.push( vertex );
                geometry.colors.push( colors );
                geometry.dat.push( { lat: lat, lng: lng, val: dataPoint[2] } )
            }
        }

        points = new THREE.Points( geometry, material );
        scene.add( points );
    }

    function createGrid(preds, gS) {

        var locatePoint = function(x, y, z_off) {

            z_off = z_off || 0;

            lat = y * gS;
            lng = x * gS;

            var phi   = (90  - lat) * Math.PI / 180;
            var theta = (180 - lng) * Math.PI / 180;

            var vertex   = new THREE.Vector3();

            vertex.x = (200 + z_off) * Math.sin(phi) * Math.cos(theta);
            vertex.y = (200 + z_off) * Math.cos(phi);
            vertex.z = (200 + z_off) * Math.sin(phi) * Math.sin(theta);

            return vertex

        };

        var createPoint = function(x, y, geometry) {

            colors = new THREE.Color("#ffffff");

            geometry.vertices.push( locatePoint(x, y, 0.5) );
            geometry.colors.push( colors );

            return geometry
        };

        var createFace = function(x, y, geometry) {

            off = geometry.vertices.length;

            x_ = x - 180 / gS;
            y_ = y - 90  / gS;

            geometry.vertices.push( locatePoint(x_    , y_    , 0.1) );
            geometry.vertices.push( locatePoint(x_ + 1, y_    , 0.1) );
            geometry.vertices.push( locatePoint(x_    , y_ + 1, 0.1) );
            geometry.vertices.push( locatePoint(x_ + 1, y_ + 1, 0.1) );

            //create a new face using vertices 0, 1, 2
            var faceA = new THREE.Face3( off + 2, off + 1, off + 3 );
            var faceB = new THREE.Face3( off + 0, off + 1, off + 2 );

            opacity = Math.max(0, (preds[y][x][1] - preds[y][x][0]) / 200);

            color = colorFn((preds[y][x][2] - 200) / 300).lerp(new THREE.Color("#FFFFFF"), opacity);

            faceA.color = color;
            faceB.color = color;

            //add the face to the geometry's faces array
            geometry.faces.push( faceA );
            geometry.faces.push( faceB );

            return geometry

        };

        var maxGeometry = new THREE.Geometry();
        var minGeometry = new THREE.Geometry();
        var faceGeom    = new THREE.Geometry();
        var maxMaterial = new THREE.PointsMaterial( { size: 1.0,  vertexColors: THREE.VertexColors } );
        var minMaterial = new THREE.PointsMaterial( { size: 0.6,  vertexColors: THREE.VertexColors } );


        for (var x = -180 / gS; x < 180 / gS; x++) {
            for (var y = -90 / gS; y < 90 / gS; y++) {

                maxGeometry = createPoint(x, y, maxGeometry);

                minGeometry = createPoint(x + 1/3, y, minGeometry);
                minGeometry = createPoint(x - 1/3, y, minGeometry);
                minGeometry = createPoint(x, y + 1/3, minGeometry);
                minGeometry = createPoint(x, y - 1/3, minGeometry);

            }
        }

        for (var x = 0 / gS; x < 360 / gS; x++) {
            for (var y = 0 / gS; y < 180 / gS; y++) {

                faceGeom = createFace(x, y, faceGeom);

            }
        }

        maxGrid = new THREE.Points( maxGeometry, maxMaterial );
        minGrid = new THREE.Points( minGeometry, minMaterial );

        var material = new THREE.MeshBasicMaterial( { vertexColors : THREE.FaceColors, opacity : 0.75, transparent: true } );

        faceGeom.colorsNeedUpdate = true;

        //the face normals and vertex normals can be calculated automatically if not supplied above
        faceGeom.computeFaceNormals();
        faceGeom.computeVertexNormals();

        datGrid = new THREE.Mesh( faceGeom, material );

        scene.add( maxGrid );
        scene.add( minGrid );
        scene.add( datGrid );

    }

    function onMouseDown(event) {
        event.preventDefault();

        container.addEventListener('mousemove', onMouseMove, false);
        container.addEventListener('mouseup', onMouseUp, false);
        container.addEventListener('mouseout', onMouseOut, false);

        mouseOnDown.x = - event.clientX;
        mouseOnDown.y = event.clientY;

        targetOnDown.x = target.x;
        targetOnDown.y = target.y;

        container.style.cursor = 'move';
    }

    function onMouseMove(event) {
        mouse.x = - event.clientX;
        mouse.y = event.clientY;

        var zoomDamp = distance/1000;

        target.x = targetOnDown.x + (mouse.x - mouseOnDown.x) * mouseSpeed / 1000 * zoomDamp;
        target.y = targetOnDown.y + (mouse.y - mouseOnDown.y) * mouseSpeed / 1000 * zoomDamp;

        target.y = target.y > PI_HALF ? PI_HALF : target.y;
        target.y = target.y < - PI_HALF ? - PI_HALF : target.y;
    }

    function onMouseUp(event) {
        container.removeEventListener('mousemove', onMouseMove, false);
        container.removeEventListener('mouseup', onMouseUp, false);
        container.removeEventListener('mouseout', onMouseOut, false);
        container.style.cursor = 'auto';
    }

    function onMouseOut(event) {
        container.removeEventListener('mousemove', onMouseMove, false);
        container.removeEventListener('mouseup', onMouseUp, false);
        container.removeEventListener('mouseout', onMouseOut, false);
    }

    function onMouseWheel(event) {
        event.preventDefault();
        if (overRenderer) {
            zoom(event.wheelDeltaY * 0.3);
        }
        return false;
    }

    function onDocumentKeyDown(event) {
        switch (event.keyCode) {
            case 38:
                zoom(100);
                event.preventDefault();
                break;
            case 40:
                zoom(-100);
                event.preventDefault();
                break;
        }
    }

    function onWindowResize( event ) {
        camera.aspect = container.offsetWidth / container.offsetHeight;
        camera.updateProjectionMatrix();
        renderer.setSize( container.offsetWidth, container.offsetHeight );
    }

    function zoom(delta) {
        distanceTarget -= delta;
        distanceTarget = distanceTarget > 1000 ? 1000 : distanceTarget;
        distanceTarget = distanceTarget < 350 ? 350 : distanceTarget;
    }

    function animate() {
        requestAnimationFrame(animate);
        render();
    }

    function render() {

        //   and direction into the scene (camera direction)
        var vector = new THREE.Vector3(mouse.x, mouse.y, 1);
        vector.unproject(camera);

        var raycaster = new THREE.Raycaster(camera.position, vector.sub(camera.position).normalize());

        var geometry = points.geometry;
        raycaster.setFromCamera( mouse, camera );
        intersects = raycaster.intersectObject( points );
        intersectsGlobe = raycaster.intersectObject( globeMesh );


        if ( intersects.length > 0 ) {

            if ( INTERSECTED != intersects[ 0 ].index ) {

                if (prevPoint) {
                    prevPoint.colors[prevInter] = prevColors;
                    prevPoint.colorsNeedUpdate = true;
                    prevColors, prevInter, prevPoint  = null;
                }

                INTERSECTED = intersects[0].index;

                updatePointData(geometry.dat[INTERSECTED]);

                prevColors = intersects[0].object.geometry.colors[INTERSECTED];
                prevInter  = INTERSECTED;
                prevPoint  = intersects[0].object.geometry;
                intersects[0].object.geometry.colors[INTERSECTED] = 0xFF3866;
                intersects[0].object.geometry.colorsNeedUpdate = true;
            }

        } else if ( INTERSECTED !== null ) {
            INTERSECTED = null;

            if (prevPoint) {
                prevPoint.colors[prevInter] = prevColors;
                prevPoint.colorsNeedUpdate = true;
                prevColors, prevInter, prevPoint = null;
            }
        }

        zoom(curZoomSpeed);

        rotation.x += (target.x - rotation.x) * 0.1;
        rotation.y += (target.y - rotation.y) * 0.1;
        distance += (distanceTarget - distance) * 0.3;

        camera.position.x = distance * Math.sin(rotation.x) * Math.cos(rotation.y);
        camera.position.y = distance * Math.sin(rotation.y);
        camera.position.z = distance * Math.cos(rotation.x) * Math.cos(rotation.y);

        camera.lookAt(mesh.position);

        renderer.render(scene, camera);
    }

    init();
    this.animate = animate;


    this.__defineGetter__('time', function() {
        return this._time || 0;
    });

    this.__defineSetter__('time', function(t) {
        var validMorphs = [];
        var morphDict = this.points.morphTargetDictionary;
        for(var k in morphDict) {
            if(k.indexOf('morphPadding') < 0) {
                validMorphs.push(morphDict[k]);
            }
        }
        validMorphs.sort();
        var l = validMorphs.length-1;
        var scaledt = t*l+1;
        var index = Math.floor(scaledt);
        for (i=0;i<validMorphs.length;i++) {
            this.points.morphTargetInfluences[validMorphs[i]] = 0;
        }
        var lastIndex = index - 1;
        var leftover = scaledt - index;
        if (lastIndex >= 0) {
            // this.points.morphTargetInfluences[lastIndex] = 1 - leftover;
        }
        // this.points.morphTargetInfluences[index] = leftover;
        this._time = t;
    });

    this.addDataPoints = addDataPoints;
    this.createGrid = createGrid;
    // this.addData = addData;
    // this.createPoints = createPoints;
    this.renderer = renderer;
    this.scene = scene;

    return this;

};

