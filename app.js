var app = (function () {

	var gl;
	var canvas;
	var prog;
	var models = [];
	var interactiveModel;
	var sphereModels = [];
	var animationAngle = 0;
	var flightRadius = 0.6;
	var angleStep = Math.PI / 18;
	var torusAngle = 0;

	var camera = {
		eye: [0, 1, 4],
		center: [0, 0, 0],
		up: [0, 1, 0],
		fovy: 60.0 * Math.PI / 180,
		lrtb: 2.0,
		vMatrix: mat4.create(),
		pMatrix: mat4.create(),
		projectionType: "perspective",
		zAngle: 0,
		distance: 4
	};

	function start() {
		init();
		render();
	}

	function init() {
		initWebGL();
		initShaderProgram();
		initUniforms();
		initModels();
		initEventHandler();
		initPipeline();
	}

	function initWebGL() {
		canvas = document.getElementById("canvas");
		gl = canvas.getContext("experimental-webgl");

		if (!gl) {
			console.log("WebGL konnte nicht initialisiert werden.");
			return;
		}

		gl.viewportWidth = canvas.width;
		gl.viewportHeight = canvas.height;
	}

	function initPipeline() {
		gl.clearColor(0.95, 0.95, 0.95, 1);

		gl.frontFace(gl.CCW);
		gl.enable(gl.CULL_FACE);
		gl.cullFace(gl.BACK);

		gl.enable(gl.DEPTH_TEST);

		gl.enable(gl.POLYGON_OFFSET_FILL);
		gl.polygonOffset(0.5, 0);

		gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);

		camera.aspect = gl.viewportWidth / gl.viewportHeight;
	}

	function initShaderProgram() {
		var vs = initShader(gl.VERTEX_SHADER, "vertexshader");
		var fs = initShader(gl.FRAGMENT_SHADER, "fragmentshader");

		prog = gl.createProgram();

		gl.attachShader(prog, vs);
		gl.attachShader(prog, fs);

		gl.bindAttribLocation(prog, 0, "aPosition");

		gl.linkProgram(prog);

		if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
			console.log("Shader-Link-Fehler: " + gl.getProgramInfoLog(prog));
		}

		gl.useProgram(prog);
	}

	function initShader(shaderType, sourceTagId) {
		var shader = gl.createShader(shaderType);
		var shaderSource = document.getElementById(sourceTagId).text;

		gl.shaderSource(shader, shaderSource);
		gl.compileShader(shader);

		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			console.log(sourceTagId + ": " + gl.getShaderInfoLog(shader));
			return null;
		}

		return shader;
	}

	function initUniforms() {
		prog.pMatrixUniform = gl.getUniformLocation(prog, "uPMatrix");
		prog.mvMatrixUniform = gl.getUniformLocation(prog, "uMVMatrix");
		prog.nMatrixUniform = gl.getUniformLocation(prog, "uNMatrix");
		prog.colorUniform = gl.getUniformLocation(prog, "uColor");
	}

	function initModels() {
		var fs = "fill";

		createModel("torus", fs, [1, 1, 1, 1], [0, 0, 0], [0, 0, 0], [1, 1, 1]);

		createModel("plane", "wireframe", [1, 1, 1, 1], [0, -0.8, 0], [0, 0, 0], [1, 1, 1]);

		createModel("sphere", fs, [0, 1, 1, 1], [0, 0, 0], [0, 0, 0], [0.12, 0.12, 0.12]);

		createModel("sphere", fs, [1, 0, 1, 1], [0, 0, 0], [0, 0, 0], [0.12, 0.12, 0.12]);

		createModel("sphere", fs, [0, 0, 1, 1], [0, 0, 0], [0, 0, 0], [0.12, 0.12, 0.12]);

		createModel("sphere", fs, [1, 1, 0, 1], [0, 0, 0], [0, 0, 0], [0.12, 0.12, 0.12]);

		interactiveModel = models[0];

		sphereModels = [models[2], models[3], models[4], models[5]];

		updateSpherePositions();
	}

	function createModel(geometryname, fillstyle, color, translate, rotate, scale) {
		var model = {};

		model.fillstyle = fillstyle;
		model.color = color;

		initDataAndBuffers(model, geometryname);
		initTransformations(model, translate, rotate, scale);

		models.push(model);
	}

	function initTransformations(model, translate, rotate, scale) {
		model.translate = translate;
		model.rotate = rotate;
		model.scale = scale;

		model.mMatrix = mat4.create();
		model.mvMatrix = mat4.create();
		model.nMatrix = mat3.create();
	}

	function initDataAndBuffers(model, geometryname) {
		window[geometryname].createVertexData.apply(model);

		model.vboPos = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, model.vboPos);
		gl.bufferData(gl.ARRAY_BUFFER, model.vertices, gl.STATIC_DRAW);

		prog.positionAttrib = gl.getAttribLocation(prog, "aPosition");
		gl.enableVertexAttribArray(prog.positionAttrib);

		model.vboNormal = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, model.vboNormal);
		gl.bufferData(gl.ARRAY_BUFFER, model.normals, gl.STATIC_DRAW);

		prog.normalAttrib = gl.getAttribLocation(prog, "aNormal");
		gl.enableVertexAttribArray(prog.normalAttrib);

		model.iboLines = gl.createBuffer();
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.iboLines);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, model.indicesLines, gl.STATIC_DRAW);

		model.iboLines.numberOfElements = model.indicesLines.length;

		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

		model.iboTris = gl.createBuffer();
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.iboTris);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, model.indicesTris, gl.STATIC_DRAW);

		model.iboTris.numberOfElements = model.indicesTris.length;

		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
	}

	function updateSpherePositions() {
		var phases = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2];

		for (var i = 0; i < sphereModels.length; i++) {
			var angle = animationAngle + phases[i];

			var x = flightRadius + flightRadius * Math.cos(angle);
			var z = flightRadius * Math.sin(angle);

			sphereModels[i].translate[0] = x;
			sphereModels[i].translate[1] = -z * Math.sin(torusAngle);
			sphereModels[i].translate[2] = z * Math.cos(torusAngle);
		}
	}

	function initEventHandler() {
		var deltaRotate = Math.PI / 36;
		var deltaTranslate = 0.05;

		window.onkeydown = function (evt) {
			var key = evt.which ? evt.which : evt.keyCode;
			var c = String.fromCharCode(key).toUpperCase();
			var sign = evt.shiftKey ? -1 : 1;

			switch (c) {
				case "O":
					camera.projectionType = "ortho";
					camera.lrtb = 2;
					break;

				case "F":
					camera.projectionType = "frustum";
					camera.lrtb = 1.2;
					break;

				case "P":
					camera.projectionType = "perspective";
					break;

				case "C":
					camera.zAngle += sign * deltaRotate;
					break;

				case "H":
					camera.eye[1] += sign * deltaTranslate;
					break;

				case "D":
					camera.distance += sign * deltaTranslate;
					break;

				case "V":
					camera.fovy += sign * 5 * Math.PI / 180;
					break;

				case "B":
					camera.lrtb += sign * 0.1;
					break;

				case "K":
					animationAngle += angleStep;
					updateSpherePositions();
					break;

				case "T":
					animationAngle += angleStep;
					torusAngle += angleStep;

					interactiveModel.rotate[0] = torusAngle;

					updateSpherePositions();
					break;
			}

			render();
		};
	}


	function render() {
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		setProjection();
		calculateCameraOrbit();

		mat4.lookAt(camera.vMatrix, camera.eye, camera.center, camera.up);

		for (var i = 0; i < models.length; i++) {

			updateTransformations(models[i]);

			gl.uniformMatrix4fv(prog.mvMatrixUniform, false, models[i].mvMatrix);
			gl.uniformMatrix3fv(prog.nMatrixUniform, false, models[i].nMatrix);
			gl.uniform4fv(prog.colorUniform, models[i].color);

			draw(models[i]);
		}
	}

	function calculateCameraOrbit() {
		var x = 0;
		var z = 2;

		camera.eye[x] = camera.center[x];
		camera.eye[z] = camera.center[z];

		camera.eye[x] += camera.distance * Math.sin(camera.zAngle);
		camera.eye[z] += camera.distance * Math.cos(camera.zAngle);
	}

	function setProjection() {

		switch (camera.projectionType) {

			case "ortho":
				var v = camera.lrtb;
				mat4.ortho(camera.pMatrix, -v, v, -v, v, -10, 10);
				break;

			case "frustum":
				var f = camera.lrtb;
				mat4.frustum(camera.pMatrix, -f / 2, f / 2, -f / 2, f / 2, 1, 10);
				break;

			case "perspective":
				mat4.perspective(camera.pMatrix, camera.fovy, camera.aspect, 1, 10);
				break;
		}

		gl.uniformMatrix4fv(prog.pMatrixUniform, false, camera.pMatrix);
	}

	function updateTransformations(model) {
		var mMatrix = model.mMatrix;
		var mvMatrix = model.mvMatrix;

		mat4.identity(mMatrix);
		mat4.identity(mvMatrix);

		mat4.translate(mMatrix, mMatrix, model.translate);

		mat4.rotateX(mMatrix, mMatrix, model.rotate[0]);
		mat4.rotateY(mMatrix, mMatrix, model.rotate[1]);
		mat4.rotateZ(mMatrix, mMatrix, model.rotate[2]);

		mat4.scale(mMatrix, mMatrix, model.scale);

		mat4.multiply(mvMatrix, camera.vMatrix, mMatrix);

		mat3.normalFromMat4(model.nMatrix, mvMatrix);
	}

	function draw(model) {

		gl.bindBuffer(gl.ARRAY_BUFFER, model.vboPos);
		gl.vertexAttribPointer(prog.positionAttrib, 3, gl.FLOAT, false, 0, 0);

		gl.bindBuffer(gl.ARRAY_BUFFER, model.vboNormal);
		gl.vertexAttribPointer(prog.normalAttrib, 3, gl.FLOAT, false, 0, 0);

		var fill = model.fillstyle.search(/fill/) !== -1;

		if (fill) {
			gl.enableVertexAttribArray(prog.normalAttrib);
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.iboTris);
			gl.drawElements(gl.TRIANGLES, model.iboTris.numberOfElements, gl.UNSIGNED_SHORT, 0);
		}

		var wireframe = model.fillstyle.search(/wireframe/) !== -1;

		if (wireframe) {
			gl.disableVertexAttribArray(prog.normalAttrib);
			gl.vertexAttrib3f(prog.normalAttrib, 0, 0, 0);
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.iboLines);
			gl.drawElements(gl.LINES, model.iboLines.numberOfElements, gl.UNSIGNED_SHORT, 0);
		}
	}

	return {
		start: start
	};

}());