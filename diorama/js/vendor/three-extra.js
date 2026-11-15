( function () {

	/**
 * Based on "A Practical Analytic Model for Daylight"
 * aka The Preetham Model, the de facto standard analytic skydome model
 * https://www.researchgate.net/publication/220720443_A_Practical_Analytic_Model_for_Daylight
 *
 * First implemented by Simon Wallner
 * http://simonwallner.at/project/atmospheric-scattering/
 *
 * Improved by Martin Upitis
 * http://blenderartists.org/forum/showthread.php?245954-preethams-sky-impementation-HDR
 *
 * Three.js integration by zz85 http://twitter.com/blurspline
*/

	class Sky extends THREE.Mesh {

		constructor() {

			const shader = Sky.SkyShader;
			const material = new THREE.ShaderMaterial( {
				name: 'SkyShader',
				fragmentShader: shader.fragmentShader,
				vertexShader: shader.vertexShader,
				uniforms: THREE.UniformsUtils.clone( shader.uniforms ),
				side: THREE.BackSide,
				depthWrite: false
			} );
			super( new THREE.BoxGeometry( 1, 1, 1 ), material );
			this.isSky = true;

		}

	}
	Sky.SkyShader = {
		uniforms: {
			'turbidity': {
				value: 2
			},
			'rayleigh': {
				value: 1
			},
			'mieCoefficient': {
				value: 0.005
			},
			'mieDirectionalG': {
				value: 0.8
			},
			'sunPosition': {
				value: new THREE.Vector3()
			},
			'up': {
				value: new THREE.Vector3( 0, 1, 0 )
			}
		},
		vertexShader: /* glsl */`
		uniform vec3 sunPosition;
		uniform float rayleigh;
		uniform float turbidity;
		uniform float mieCoefficient;
		uniform vec3 up;

		varying vec3 vWorldPosition;
		varying vec3 vSunDirection;
		varying float vSunfade;
		varying vec3 vBetaR;
		varying vec3 vBetaM;
		varying float vSunE;

		// constants for atmospheric scattering
		const float e = 2.71828182845904523536028747135266249775724709369995957;
		const float pi = 3.141592653589793238462643383279502884197169;

		// wavelength of used primaries, according to preetham
		const vec3 lambda = vec3( 680E-9, 550E-9, 450E-9 );
		// this pre-calcuation replaces older TotalRayleigh(vec3 lambda) function:
		// (8.0 * pow(pi, 3.0) * pow(pow(n, 2.0) - 1.0, 2.0) * (6.0 + 3.0 * pn)) / (3.0 * N * pow(lambda, vec3(4.0)) * (6.0 - 7.0 * pn))
		const vec3 totalRayleigh = vec3( 5.804542996261093E-6, 1.3562911419845635E-5, 3.0265902468824876E-5 );

		// mie stuff
		// K coefficient for the primaries
		const float v = 4.0;
		const vec3 K = vec3( 0.686, 0.678, 0.666 );
		// MieConst = pi * pow( ( 2.0 * pi ) / lambda, vec3( v - 2.0 ) ) * K
		const vec3 MieConst = vec3( 1.8399918514433978E14, 2.7798023919660528E14, 4.0790479543861094E14 );

		// earth shadow hack
		// cutoffAngle = pi / 1.95;
		const float cutoffAngle = 1.6110731556870734;
		const float steepness = 1.5;
		const float EE = 1000.0;

		float sunIntensity( float zenithAngleCos ) {
			zenithAngleCos = clamp( zenithAngleCos, -1.0, 1.0 );
			return EE * max( 0.0, 1.0 - pow( e, -( ( cutoffAngle - acos( zenithAngleCos ) ) / steepness ) ) );
		}

		vec3 totalMie( float T ) {
			float c = ( 0.2 * T ) * 10E-18;
			return 0.434 * c * MieConst;
		}

		void main() {

			vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
			vWorldPosition = worldPosition.xyz;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			gl_Position.z = gl_Position.w; // set z to camera.far

			vSunDirection = normalize( sunPosition );

			vSunE = sunIntensity( dot( vSunDirection, up ) );

			vSunfade = 1.0 - clamp( 1.0 - exp( ( sunPosition.y / 450000.0 ) ), 0.0, 1.0 );

			float rayleighCoefficient = rayleigh - ( 1.0 * ( 1.0 - vSunfade ) );

			// extinction (absorbtion + out scattering)
			// rayleigh coefficients
			vBetaR = totalRayleigh * rayleighCoefficient;

			// mie coefficients
			vBetaM = totalMie( turbidity ) * mieCoefficient;

		}`,
		fragmentShader: /* glsl */`
		varying vec3 vWorldPosition;
		varying vec3 vSunDirection;
		varying float vSunfade;
		varying vec3 vBetaR;
		varying vec3 vBetaM;
		varying float vSunE;

		uniform float mieDirectionalG;
		uniform vec3 up;

		const vec3 cameraPos = vec3( 0.0, 0.0, 0.0 );

		// constants for atmospheric scattering
		const float pi = 3.141592653589793238462643383279502884197169;

		const float n = 1.0003; // refractive index of air
		const float N = 2.545E25; // number of molecules per unit volume for air at 288.15K and 1013mb (sea level -45 celsius)

		// optical length at zenith for molecules
		const float rayleighZenithLength = 8.4E3;
		const float mieZenithLength = 1.25E3;
		// 66 arc seconds -> degrees, and the cosine of that
		const float sunAngularDiameterCos = 0.999956676946448443553574619906976478926848692873900859324;

		// 3.0 / ( 16.0 * pi )
		const float THREE_OVER_SIXTEENPI = 0.05968310365946075;
		// 1.0 / ( 4.0 * pi )
		const float ONE_OVER_FOURPI = 0.07957747154594767;

		float rayleighPhase( float cosTheta ) {
			return THREE_OVER_SIXTEENPI * ( 1.0 + pow( cosTheta, 2.0 ) );
		}

		float hgPhase( float cosTheta, float g ) {
			float g2 = pow( g, 2.0 );
			float inverse = 1.0 / pow( 1.0 - 2.0 * g * cosTheta + g2, 1.5 );
			return ONE_OVER_FOURPI * ( ( 1.0 - g2 ) * inverse );
		}

		void main() {

			vec3 direction = normalize( vWorldPosition - cameraPos );

			// optical length
			// cutoff angle at 90 to avoid singularity in next formula.
			float zenithAngle = acos( max( 0.0, dot( up, direction ) ) );
			float inverse = 1.0 / ( cos( zenithAngle ) + 0.15 * pow( 93.885 - ( ( zenithAngle * 180.0 ) / pi ), -1.253 ) );
			float sR = rayleighZenithLength * inverse;
			float sM = mieZenithLength * inverse;

			// combined extinction factor
			vec3 Fex = exp( -( vBetaR * sR + vBetaM * sM ) );

			// in scattering
			float cosTheta = dot( direction, vSunDirection );

			float rPhase = rayleighPhase( cosTheta * 0.5 + 0.5 );
			vec3 betaRTheta = vBetaR * rPhase;

			float mPhase = hgPhase( cosTheta, mieDirectionalG );
			vec3 betaMTheta = vBetaM * mPhase;

			vec3 Lin = pow( vSunE * ( ( betaRTheta + betaMTheta ) / ( vBetaR + vBetaM ) ) * ( 1.0 - Fex ), vec3( 1.5 ) );
			Lin *= mix( vec3( 1.0 ), pow( vSunE * ( ( betaRTheta + betaMTheta ) / ( vBetaR + vBetaM ) ) * Fex, vec3( 1.0 / 2.0 ) ), clamp( pow( 1.0 - dot( up, vSunDirection ), 5.0 ), 0.0, 1.0 ) );

			// nightsky
			float theta = acos( direction.y ); // elevation --> y-axis, [-pi/2, pi/2]
			float phi = atan( direction.z, direction.x ); // azimuth --> x-axis [-pi/2, pi/2]
			vec2 uv = vec2( phi, theta ) / vec2( 2.0 * pi, pi ) + vec2( 0.5, 0.0 );
			vec3 L0 = vec3( 0.1 ) * Fex;

			// composition + solar disc
			float sundisk = smoothstep( sunAngularDiameterCos, sunAngularDiameterCos + 0.00002, cosTheta );
			L0 += ( vSunE * 19000.0 * Fex ) * sundisk;

			vec3 texColor = ( Lin + L0 ) * 0.04 + vec3( 0.0, 0.0003, 0.00075 );

			vec3 retColor = pow( texColor, vec3( 1.0 / ( 1.2 + ( 1.2 * vSunfade ) ) ) );

			gl_FragColor = vec4( retColor, 1.0 );

			#include <tonemapping_fragment>
			#include <encodings_fragment>

		}`
	};

	THREE.Sky = Sky;

} )();
( function () {

	function computeTangents() {

		throw new Error( 'BufferGeometryUtils: computeTangents renamed to computeMikkTSpaceTangents.' );

	}

	function computeMikkTSpaceTangents( geometry, MikkTSpace, negateSign = true ) {

		if ( ! MikkTSpace || ! MikkTSpace.isReady ) {

			throw new Error( 'BufferGeometryUtils: Initialized MikkTSpace library required.' );

		}

		if ( ! geometry.hasAttribute( 'position' ) || ! geometry.hasAttribute( 'normal' ) || ! geometry.hasAttribute( 'uv' ) ) {

			throw new Error( 'BufferGeometryUtils: Tangents require "position", "normal", and "uv" attributes.' );

		}

		function getAttributeArray( attribute ) {

			if ( attribute.normalized || attribute.isInterleavedBufferAttribute ) {

				const dstArray = new Float32Array( attribute.getCount() * attribute.itemSize );
				for ( let i = 0, j = 0; i < attribute.getCount(); i ++ ) {

					dstArray[ j ++ ] = attribute.getX( i );
					dstArray[ j ++ ] = attribute.getY( i );
					if ( attribute.itemSize > 2 ) {

						dstArray[ j ++ ] = attribute.getZ( i );

					}

				}

				return dstArray;

			}

			if ( attribute.array instanceof Float32Array ) {

				return attribute.array;

			}

			return new Float32Array( attribute.array );

		}

		// MikkTSpace algorithm requires non-indexed input.

		const _geometry = geometry.index ? geometry.toNonIndexed() : geometry;

		// Compute vertex tangents.

		const tangents = MikkTSpace.generateTangents( getAttributeArray( _geometry.attributes.position ), getAttributeArray( _geometry.attributes.normal ), getAttributeArray( _geometry.attributes.uv ) );

		// Texture coordinate convention of glTF differs from the apparent
		// default of the MikkTSpace library; .w component must be flipped.

		if ( negateSign ) {

			for ( let i = 3; i < tangents.length; i += 4 ) {

				tangents[ i ] *= - 1;

			}

		}

		//

		_geometry.setAttribute( 'tangent', new THREE.BufferAttribute( tangents, 4 ) );
		if ( geometry !== _geometry ) {

			geometry.copy( _geometry );

		}

		return geometry;

	}

	/**
 * @param  {Array<BufferGeometry>} geometries
 * @param  {Boolean} useGroups
 * @return {BufferGeometry}
 */
	function mergeBufferGeometries( geometries, useGroups = false ) {

		const isIndexed = geometries[ 0 ].index !== null;
		const attributesUsed = new Set( Object.keys( geometries[ 0 ].attributes ) );
		const morphAttributesUsed = new Set( Object.keys( geometries[ 0 ].morphAttributes ) );
		const attributes = {};
		const morphAttributes = {};
		const morphTargetsRelative = geometries[ 0 ].morphTargetsRelative;
		const mergedGeometry = new THREE.BufferGeometry();
		let offset = 0;
		for ( let i = 0; i < geometries.length; ++ i ) {

			const geometry = geometries[ i ];
			let attributesCount = 0;

			// ensure that all geometries are indexed, or none

			if ( isIndexed !== ( geometry.index !== null ) ) {

				console.error( 'THREE.BufferGeometryUtils: .mergeBufferGeometries() failed with geometry at index ' + i + '. All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them.' );
				return null;

			}

			// gather attributes, exit early if they're different

			for ( const name in geometry.attributes ) {

				if ( ! attributesUsed.has( name ) ) {

					console.error( 'THREE.BufferGeometryUtils: .mergeBufferGeometries() failed with geometry at index ' + i + '. All geometries must have compatible attributes; make sure "' + name + '" attribute exists among all geometries, or in none of them.' );
					return null;

				}

				if ( attributes[ name ] === undefined ) attributes[ name ] = [];
				attributes[ name ].push( geometry.attributes[ name ] );
				attributesCount ++;

			}

			// ensure geometries have the same number of attributes

			if ( attributesCount !== attributesUsed.size ) {

				console.error( 'THREE.BufferGeometryUtils: .mergeBufferGeometries() failed with geometry at index ' + i + '. Make sure all geometries have the same number of attributes.' );
				return null;

			}

			// gather morph attributes, exit early if they're different

			if ( morphTargetsRelative !== geometry.morphTargetsRelative ) {

				console.error( 'THREE.BufferGeometryUtils: .mergeBufferGeometries() failed with geometry at index ' + i + '. .morphTargetsRelative must be consistent throughout all geometries.' );
				return null;

			}

			for ( const name in geometry.morphAttributes ) {

				if ( ! morphAttributesUsed.has( name ) ) {

					console.error( 'THREE.BufferGeometryUtils: .mergeBufferGeometries() failed with geometry at index ' + i + '.  .morphAttributes must be consistent throughout all geometries.' );
					return null;

				}

				if ( morphAttributes[ name ] === undefined ) morphAttributes[ name ] = [];
				morphAttributes[ name ].push( geometry.morphAttributes[ name ] );

			}

			if ( useGroups ) {

				let count;
				if ( isIndexed ) {

					count = geometry.index.count;

				} else if ( geometry.attributes.position !== undefined ) {

					count = geometry.attributes.position.count;

				} else {

					console.error( 'THREE.BufferGeometryUtils: .mergeBufferGeometries() failed with geometry at index ' + i + '. The geometry must have either an index or a position attribute' );
					return null;

				}

				mergedGeometry.addGroup( offset, count, i );
				offset += count;

			}

		}

		// merge indices

		if ( isIndexed ) {

			let indexOffset = 0;
			const mergedIndex = [];
			for ( let i = 0; i < geometries.length; ++ i ) {

				const index = geometries[ i ].index;
				for ( let j = 0; j < index.count; ++ j ) {

					mergedIndex.push( index.getX( j ) + indexOffset );

				}

				indexOffset += geometries[ i ].attributes.position.count;

			}

			mergedGeometry.setIndex( mergedIndex );

		}

		// merge attributes

		for ( const name in attributes ) {

			const mergedAttribute = mergeBufferAttributes( attributes[ name ] );
			if ( ! mergedAttribute ) {

				console.error( 'THREE.BufferGeometryUtils: .mergeBufferGeometries() failed while trying to merge the ' + name + ' attribute.' );
				return null;

			}

			mergedGeometry.setAttribute( name, mergedAttribute );

		}

		// merge morph attributes

		for ( const name in morphAttributes ) {

			const numMorphTargets = morphAttributes[ name ][ 0 ].length;
			if ( numMorphTargets === 0 ) break;
			mergedGeometry.morphAttributes = mergedGeometry.morphAttributes || {};
			mergedGeometry.morphAttributes[ name ] = [];
			for ( let i = 0; i < numMorphTargets; ++ i ) {

				const morphAttributesToMerge = [];
				for ( let j = 0; j < morphAttributes[ name ].length; ++ j ) {

					morphAttributesToMerge.push( morphAttributes[ name ][ j ][ i ] );

				}

				const mergedMorphAttribute = mergeBufferAttributes( morphAttributesToMerge );
				if ( ! mergedMorphAttribute ) {

					console.error( 'THREE.BufferGeometryUtils: .mergeBufferGeometries() failed while trying to merge the ' + name + ' morphAttribute.' );
					return null;

				}

				mergedGeometry.morphAttributes[ name ].push( mergedMorphAttribute );

			}

		}

		return mergedGeometry;

	}

	/**
 * @param {Array<BufferAttribute>} attributes
 * @return {BufferAttribute}
 */
	function mergeBufferAttributes( attributes ) {

		let TypedArray;
		let itemSize;
		let normalized;
		let arrayLength = 0;
		for ( let i = 0; i < attributes.length; ++ i ) {

			const attribute = attributes[ i ];
			if ( attribute.isInterleavedBufferAttribute ) {

				console.error( 'THREE.BufferGeometryUtils: .mergeBufferAttributes() failed. InterleavedBufferAttributes are not supported.' );
				return null;

			}

			if ( TypedArray === undefined ) TypedArray = attribute.array.constructor;
			if ( TypedArray !== attribute.array.constructor ) {

				console.error( 'THREE.BufferGeometryUtils: .mergeBufferAttributes() failed. THREE.BufferAttribute.array must be of consistent array types across matching attributes.' );
				return null;

			}

			if ( itemSize === undefined ) itemSize = attribute.itemSize;
			if ( itemSize !== attribute.itemSize ) {

				console.error( 'THREE.BufferGeometryUtils: .mergeBufferAttributes() failed. THREE.BufferAttribute.itemSize must be consistent across matching attributes.' );
				return null;

			}

			if ( normalized === undefined ) normalized = attribute.normalized;
			if ( normalized !== attribute.normalized ) {

				console.error( 'THREE.BufferGeometryUtils: .mergeBufferAttributes() failed. THREE.BufferAttribute.normalized must be consistent across matching attributes.' );
				return null;

			}

			arrayLength += attribute.array.length;

		}

		const array = new TypedArray( arrayLength );
		let offset = 0;
		for ( let i = 0; i < attributes.length; ++ i ) {

			array.set( attributes[ i ].array, offset );
			offset += attributes[ i ].array.length;

		}

		return new THREE.BufferAttribute( array, itemSize, normalized );

	}

	/**
 * @param {BufferAttribute}
 * @return {BufferAttribute}
 */
	function deepCloneAttribute( attribute ) {

		if ( attribute.isInstancedInterleavedBufferAttribute || attribute.isInterleavedBufferAttribute ) {

			return deinterleaveAttribute( attribute );

		}

		if ( attribute.isInstancedBufferAttribute ) {

			return new THREE.InstancedBufferAttribute().copy( attribute );

		}

		return new THREE.BufferAttribute().copy( attribute );

	}

	/**
 * @param {Array<BufferAttribute>} attributes
 * @return {Array<InterleavedBufferAttribute>}
 */
	function interleaveAttributes( attributes ) {

		// Interleaves the provided attributes into an THREE.InterleavedBuffer and returns
		// a set of InterleavedBufferAttributes for each attribute
		let TypedArray;
		let arrayLength = 0;
		let stride = 0;

		// calculate the length and type of the interleavedBuffer
		for ( let i = 0, l = attributes.length; i < l; ++ i ) {

			const attribute = attributes[ i ];
			if ( TypedArray === undefined ) TypedArray = attribute.array.constructor;
			if ( TypedArray !== attribute.array.constructor ) {

				console.error( 'AttributeBuffers of different types cannot be interleaved' );
				return null;

			}

			arrayLength += attribute.array.length;
			stride += attribute.itemSize;

		}

		// Create the set of buffer attributes
		const interleavedBuffer = new THREE.InterleavedBuffer( new TypedArray( arrayLength ), stride );
		let offset = 0;
		const res = [];
		const getters = [ 'getX', 'getY', 'getZ', 'getW' ];
		const setters = [ 'setX', 'setY', 'setZ', 'setW' ];
		for ( let j = 0, l = attributes.length; j < l; j ++ ) {

			const attribute = attributes[ j ];
			const itemSize = attribute.itemSize;
			const count = attribute.count;
			const iba = new THREE.InterleavedBufferAttribute( interleavedBuffer, itemSize, offset, attribute.normalized );
			res.push( iba );
			offset += itemSize;

			// Move the data for each attribute into the new interleavedBuffer
			// at the appropriate offset
			for ( let c = 0; c < count; c ++ ) {

				for ( let k = 0; k < itemSize; k ++ ) {

					iba[ setters[ k ] ]( c, attribute[ getters[ k ] ]( c ) );

				}

			}

		}

		return res;

	}

	// returns a new, non-interleaved version of the provided attribute
	function deinterleaveAttribute( attribute ) {

		const cons = attribute.data.array.constructor;
		const count = attribute.count;
		const itemSize = attribute.itemSize;
		const normalized = attribute.normalized;
		const array = new cons( count * itemSize );
		let newAttribute;
		if ( attribute.isInstancedInterleavedBufferAttribute ) {

			newAttribute = new THREE.InstancedBufferAttribute( array, itemSize, normalized, attribute.meshPerAttribute );

		} else {

			newAttribute = new THREE.BufferAttribute( array, itemSize, normalized );

		}

		for ( let i = 0; i < count; i ++ ) {

			newAttribute.setX( i, attribute.getX( i ) );
			if ( itemSize >= 2 ) {

				newAttribute.setY( i, attribute.getY( i ) );

			}

			if ( itemSize >= 3 ) {

				newAttribute.setZ( i, attribute.getZ( i ) );

			}

			if ( itemSize >= 4 ) {

				newAttribute.setW( i, attribute.getW( i ) );

			}

		}

		return newAttribute;

	}

	// deinterleaves all attributes on the geometry
	function deinterleaveGeometry( geometry ) {

		const attributes = geometry.attributes;
		const morphTargets = geometry.morphTargets;
		const attrMap = new Map();
		for ( const key in attributes ) {

			const attr = attributes[ key ];
			if ( attr.isInterleavedBufferAttribute ) {

				if ( ! attrMap.has( attr ) ) {

					attrMap.set( attr, deinterleaveAttribute( attr ) );

				}

				attributes[ key ] = attrMap.get( attr );

			}

		}

		for ( const key in morphTargets ) {

			const attr = morphTargets[ key ];
			if ( attr.isInterleavedBufferAttribute ) {

				if ( ! attrMap.has( attr ) ) {

					attrMap.set( attr, deinterleaveAttribute( attr ) );

				}

				morphTargets[ key ] = attrMap.get( attr );

			}

		}

	}

	/**
 * @param {Array<BufferGeometry>} geometry
 * @return {number}
 */
	function estimateBytesUsed( geometry ) {

		// Return the estimated memory used by this geometry in bytes
		// Calculate using itemSize, count, and BYTES_PER_ELEMENT to account
		// for InterleavedBufferAttributes.
		let mem = 0;
		for ( const name in geometry.attributes ) {

			const attr = geometry.getAttribute( name );
			mem += attr.count * attr.itemSize * attr.array.BYTES_PER_ELEMENT;

		}

		const indices = geometry.getIndex();
		mem += indices ? indices.count * indices.itemSize * indices.array.BYTES_PER_ELEMENT : 0;
		return mem;

	}

	/**
 * @param {BufferGeometry} geometry
 * @param {number} tolerance
 * @return {BufferGeometry}
 */
	function mergeVertices( geometry, tolerance = 1e-4 ) {

		tolerance = Math.max( tolerance, Number.EPSILON );

		// Generate an index buffer if the geometry doesn't have one, or optimize it
		// if it's already available.
		const hashToIndex = {};
		const indices = geometry.getIndex();
		const positions = geometry.getAttribute( 'position' );
		const vertexCount = indices ? indices.count : positions.count;

		// next value for triangle indices
		let nextIndex = 0;

		// attributes and new attribute arrays
		const attributeNames = Object.keys( geometry.attributes );
		const tmpAttributes = {};
		const tmpMorphAttributes = {};
		const newIndices = [];
		const getters = [ 'getX', 'getY', 'getZ', 'getW' ];
		const setters = [ 'setX', 'setY', 'setZ', 'setW' ];

		// Initialize the arrays, allocating space conservatively. Extra
		// space will be trimmed in the last step.
		for ( let i = 0, l = attributeNames.length; i < l; i ++ ) {

			const name = attributeNames[ i ];
			const attr = geometry.attributes[ name ];
			tmpAttributes[ name ] = new THREE.BufferAttribute( new attr.array.constructor( attr.count * attr.itemSize ), attr.itemSize, attr.normalized );
			const morphAttr = geometry.morphAttributes[ name ];
			if ( morphAttr ) {

				tmpMorphAttributes[ name ] = new THREE.BufferAttribute( new morphAttr.array.constructor( morphAttr.count * morphAttr.itemSize ), morphAttr.itemSize, morphAttr.normalized );

			}

		}

		// convert the error tolerance to an amount of decimal places to truncate to
		const decimalShift = Math.log10( 1 / tolerance );
		const shiftMultiplier = Math.pow( 10, decimalShift );
		for ( let i = 0; i < vertexCount; i ++ ) {

			const index = indices ? indices.getX( i ) : i;

			// Generate a hash for the vertex attributes at the current index 'i'
			let hash = '';
			for ( let j = 0, l = attributeNames.length; j < l; j ++ ) {

				const name = attributeNames[ j ];
				const attribute = geometry.getAttribute( name );
				const itemSize = attribute.itemSize;
				for ( let k = 0; k < itemSize; k ++ ) {

					// double tilde truncates the decimal value
					hash += `${~ ~ ( attribute[ getters[ k ] ]( index ) * shiftMultiplier )},`;

				}

			}

			// Add another reference to the vertex if it's already
			// used by another index
			if ( hash in hashToIndex ) {

				newIndices.push( hashToIndex[ hash ] );

			} else {

				// copy data to the new index in the temporary attributes
				for ( let j = 0, l = attributeNames.length; j < l; j ++ ) {

					const name = attributeNames[ j ];
					const attribute = geometry.getAttribute( name );
					const morphAttr = geometry.morphAttributes[ name ];
					const itemSize = attribute.itemSize;
					const newarray = tmpAttributes[ name ];
					const newMorphArrays = tmpMorphAttributes[ name ];
					for ( let k = 0; k < itemSize; k ++ ) {

						const getterFunc = getters[ k ];
						const setterFunc = setters[ k ];
						newarray[ setterFunc ]( nextIndex, attribute[ getterFunc ]( index ) );
						if ( morphAttr ) {

							for ( let m = 0, ml = morphAttr.length; m < ml; m ++ ) {

								newMorphArrays[ m ][ setterFunc ]( nextIndex, morphAttr[ m ][ getterFunc ]( index ) );

							}

						}

					}

				}

				hashToIndex[ hash ] = nextIndex;
				newIndices.push( nextIndex );
				nextIndex ++;

			}

		}

		// generate result THREE.BufferGeometry
		const result = geometry.clone();
		for ( const name in geometry.attributes ) {

			const tmpAttribute = tmpAttributes[ name ];
			result.setAttribute( name, new THREE.BufferAttribute( tmpAttribute.array.slice( 0, nextIndex * tmpAttribute.itemSize ), tmpAttribute.itemSize, tmpAttribute.normalized ) );
			if ( ! ( name in tmpMorphAttributes ) ) continue;
			for ( let j = 0; j < tmpMorphAttributes[ name ].length; j ++ ) {

				const tmpMorphAttribute = tmpMorphAttributes[ name ][ j ];
				result.morphAttributes[ name ][ j ] = new THREE.BufferAttribute( tmpMorphAttribute.array.slice( 0, nextIndex * tmpMorphAttribute.itemSize ), tmpMorphAttribute.itemSize, tmpMorphAttribute.normalized );

			}

		}

		// indices

		result.setIndex( newIndices );
		return result;

	}

	/**
 * @param {BufferGeometry} geometry
 * @param {number} drawMode
 * @return {BufferGeometry}
 */
	function toTrianglesDrawMode( geometry, drawMode ) {

		if ( drawMode === THREE.TrianglesDrawMode ) {

			console.warn( 'THREE.BufferGeometryUtils.toTrianglesDrawMode(): Geometry already defined as triangles.' );
			return geometry;

		}

		if ( drawMode === THREE.TriangleFanDrawMode || drawMode === THREE.TriangleStripDrawMode ) {

			let index = geometry.getIndex();

			// generate index if not present

			if ( index === null ) {

				const indices = [];
				const position = geometry.getAttribute( 'position' );
				if ( position !== undefined ) {

					for ( let i = 0; i < position.count; i ++ ) {

						indices.push( i );

					}

					geometry.setIndex( indices );
					index = geometry.getIndex();

				} else {

					console.error( 'THREE.BufferGeometryUtils.toTrianglesDrawMode(): Undefined position attribute. Processing not possible.' );
					return geometry;

				}

			}

			//

			const numberOfTriangles = index.count - 2;
			const newIndices = [];
			if ( drawMode === THREE.TriangleFanDrawMode ) {

				// gl.TRIANGLE_FAN

				for ( let i = 1; i <= numberOfTriangles; i ++ ) {

					newIndices.push( index.getX( 0 ) );
					newIndices.push( index.getX( i ) );
					newIndices.push( index.getX( i + 1 ) );

				}

			} else {

				// gl.TRIANGLE_STRIP

				for ( let i = 0; i < numberOfTriangles; i ++ ) {

					if ( i % 2 === 0 ) {

						newIndices.push( index.getX( i ) );
						newIndices.push( index.getX( i + 1 ) );
						newIndices.push( index.getX( i + 2 ) );

					} else {

						newIndices.push( index.getX( i + 2 ) );
						newIndices.push( index.getX( i + 1 ) );
						newIndices.push( index.getX( i ) );

					}

				}

			}

			if ( newIndices.length / 3 !== numberOfTriangles ) {

				console.error( 'THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unable to generate correct amount of triangles.' );

			}

			// build final geometry

			const newGeometry = geometry.clone();
			newGeometry.setIndex( newIndices );
			newGeometry.clearGroups();
			return newGeometry;

		} else {

			console.error( 'THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unknown draw mode:', drawMode );
			return geometry;

		}

	}

	/**
 * Calculates the morphed attributes of a morphed/skinned THREE.BufferGeometry.
 * Helpful for Raytracing or Decals.
 * @param {Mesh | Line | Points} object An instance of Mesh, Line or Points.
 * @return {Object} An Object with original position/normal attributes and morphed ones.
 */
	function computeMorphedAttributes( object ) {

		if ( object.geometry.isBufferGeometry !== true ) {

			console.error( 'THREE.BufferGeometryUtils: Geometry is not of type THREE.BufferGeometry.' );
			return null;

		}

		const _vA = new THREE.Vector3();
		const _vB = new THREE.Vector3();
		const _vC = new THREE.Vector3();
		const _tempA = new THREE.Vector3();
		const _tempB = new THREE.Vector3();
		const _tempC = new THREE.Vector3();
		const _morphA = new THREE.Vector3();
		const _morphB = new THREE.Vector3();
		const _morphC = new THREE.Vector3();
		function _calculateMorphedAttributeData( object, attribute, morphAttribute, morphTargetsRelative, a, b, c, modifiedAttributeArray ) {

			_vA.fromBufferAttribute( attribute, a );
			_vB.fromBufferAttribute( attribute, b );
			_vC.fromBufferAttribute( attribute, c );
			const morphInfluences = object.morphTargetInfluences;
			if ( morphAttribute && morphInfluences ) {

				_morphA.set( 0, 0, 0 );
				_morphB.set( 0, 0, 0 );
				_morphC.set( 0, 0, 0 );
				for ( let i = 0, il = morphAttribute.length; i < il; i ++ ) {

					const influence = morphInfluences[ i ];
					const morph = morphAttribute[ i ];
					if ( influence === 0 ) continue;
					_tempA.fromBufferAttribute( morph, a );
					_tempB.fromBufferAttribute( morph, b );
					_tempC.fromBufferAttribute( morph, c );
					if ( morphTargetsRelative ) {

						_morphA.addScaledVector( _tempA, influence );
						_morphB.addScaledVector( _tempB, influence );
						_morphC.addScaledVector( _tempC, influence );

					} else {

						_morphA.addScaledVector( _tempA.sub( _vA ), influence );
						_morphB.addScaledVector( _tempB.sub( _vB ), influence );
						_morphC.addScaledVector( _tempC.sub( _vC ), influence );

					}

				}

				_vA.add( _morphA );
				_vB.add( _morphB );
				_vC.add( _morphC );

			}

			if ( object.isSkinnedMesh ) {

				object.boneTransform( a, _vA );
				object.boneTransform( b, _vB );
				object.boneTransform( c, _vC );

			}

			modifiedAttributeArray[ a * 3 + 0 ] = _vA.x;
			modifiedAttributeArray[ a * 3 + 1 ] = _vA.y;
			modifiedAttributeArray[ a * 3 + 2 ] = _vA.z;
			modifiedAttributeArray[ b * 3 + 0 ] = _vB.x;
			modifiedAttributeArray[ b * 3 + 1 ] = _vB.y;
			modifiedAttributeArray[ b * 3 + 2 ] = _vB.z;
			modifiedAttributeArray[ c * 3 + 0 ] = _vC.x;
			modifiedAttributeArray[ c * 3 + 1 ] = _vC.y;
			modifiedAttributeArray[ c * 3 + 2 ] = _vC.z;

		}

		const geometry = object.geometry;
		const material = object.material;
		let a, b, c;
		const index = geometry.index;
		const positionAttribute = geometry.attributes.position;
		const morphPosition = geometry.morphAttributes.position;
		const morphTargetsRelative = geometry.morphTargetsRelative;
		const normalAttribute = geometry.attributes.normal;
		const morphNormal = geometry.morphAttributes.position;
		const groups = geometry.groups;
		const drawRange = geometry.drawRange;
		let i, j, il, jl;
		let group;
		let start, end;
		const modifiedPosition = new Float32Array( positionAttribute.count * positionAttribute.itemSize );
		const modifiedNormal = new Float32Array( normalAttribute.count * normalAttribute.itemSize );
		if ( index !== null ) {

			// indexed buffer geometry

			if ( Array.isArray( material ) ) {

				for ( i = 0, il = groups.length; i < il; i ++ ) {

					group = groups[ i ];
					start = Math.max( group.start, drawRange.start );
					end = Math.min( group.start + group.count, drawRange.start + drawRange.count );
					for ( j = start, jl = end; j < jl; j += 3 ) {

						a = index.getX( j );
						b = index.getX( j + 1 );
						c = index.getX( j + 2 );
						_calculateMorphedAttributeData( object, positionAttribute, morphPosition, morphTargetsRelative, a, b, c, modifiedPosition );
						_calculateMorphedAttributeData( object, normalAttribute, morphNormal, morphTargetsRelative, a, b, c, modifiedNormal );

					}

				}

			} else {

				start = Math.max( 0, drawRange.start );
				end = Math.min( index.count, drawRange.start + drawRange.count );
				for ( i = start, il = end; i < il; i += 3 ) {

					a = index.getX( i );
					b = index.getX( i + 1 );
					c = index.getX( i + 2 );
					_calculateMorphedAttributeData( object, positionAttribute, morphPosition, morphTargetsRelative, a, b, c, modifiedPosition );
					_calculateMorphedAttributeData( object, normalAttribute, morphNormal, morphTargetsRelative, a, b, c, modifiedNormal );

				}

			}

		} else {

			// non-indexed buffer geometry

			if ( Array.isArray( material ) ) {

				for ( i = 0, il = groups.length; i < il; i ++ ) {

					group = groups[ i ];
					start = Math.max( group.start, drawRange.start );
					end = Math.min( group.start + group.count, drawRange.start + drawRange.count );
					for ( j = start, jl = end; j < jl; j += 3 ) {

						a = j;
						b = j + 1;
						c = j + 2;
						_calculateMorphedAttributeData( object, positionAttribute, morphPosition, morphTargetsRelative, a, b, c, modifiedPosition );
						_calculateMorphedAttributeData( object, normalAttribute, morphNormal, morphTargetsRelative, a, b, c, modifiedNormal );

					}

				}

			} else {

				start = Math.max( 0, drawRange.start );
				end = Math.min( positionAttribute.count, drawRange.start + drawRange.count );
				for ( i = start, il = end; i < il; i += 3 ) {

					a = i;
					b = i + 1;
					c = i + 2;
					_calculateMorphedAttributeData( object, positionAttribute, morphPosition, morphTargetsRelative, a, b, c, modifiedPosition );
					_calculateMorphedAttributeData( object, normalAttribute, morphNormal, morphTargetsRelative, a, b, c, modifiedNormal );

				}

			}

		}

		const morphedPositionAttribute = new THREE.Float32BufferAttribute( modifiedPosition, 3 );
		const morphedNormalAttribute = new THREE.Float32BufferAttribute( modifiedNormal, 3 );
		return {
			positionAttribute: positionAttribute,
			normalAttribute: normalAttribute,
			morphedPositionAttribute: morphedPositionAttribute,
			morphedNormalAttribute: morphedNormalAttribute
		};

	}

	function mergeGroups( geometry ) {

		if ( geometry.groups.length === 0 ) {

			console.warn( 'THREE.BufferGeometryUtils.mergeGroups(): No groups are defined. Nothing to merge.' );
			return geometry;

		}

		let groups = geometry.groups;

		// sort groups by material index

		groups = groups.sort( ( a, b ) => {

			if ( a.materialIndex !== b.materialIndex ) return a.materialIndex - b.materialIndex;
			return a.start - b.start;

		} );

		// create index for non-indexed geometries

		if ( geometry.getIndex() === null ) {

			const positionAttribute = geometry.getAttribute( 'position' );
			const indices = [];
			for ( let i = 0; i < positionAttribute.count; i += 3 ) {

				indices.push( i, i + 1, i + 2 );

			}

			geometry.setIndex( indices );

		}

		// sort index

		const index = geometry.getIndex();
		const newIndices = [];
		for ( let i = 0; i < groups.length; i ++ ) {

			const group = groups[ i ];
			const groupStart = group.start;
			const groupLength = groupStart + group.count;
			for ( let j = groupStart; j < groupLength; j ++ ) {

				newIndices.push( index.getX( j ) );

			}

		}

		geometry.dispose(); // Required to force buffer recreation
		geometry.setIndex( newIndices );

		// update groups indices

		let start = 0;
		for ( let i = 0; i < groups.length; i ++ ) {

			const group = groups[ i ];
			group.start = start;
			start += group.count;

		}

		// merge groups

		let currentGroup = groups[ 0 ];
		geometry.groups = [ currentGroup ];
		for ( let i = 1; i < groups.length; i ++ ) {

			const group = groups[ i ];
			if ( currentGroup.materialIndex === group.materialIndex ) {

				currentGroup.count += group.count;

			} else {

				currentGroup = group;
				geometry.groups.push( currentGroup );

			}

		}

		return geometry;

	}

	// Creates a new, non-indexed geometry with smooth normals everywhere except faces that meet at
	// an angle greater than the crease angle.
	function toCreasedNormals( geometry, creaseAngle = Math.PI / 3 /* 60 degrees */ ) {

		const creaseDot = Math.cos( creaseAngle );
		const hashMultiplier = ( 1 + 1e-10 ) * 1e2;

		// reusable vertors
		const verts = [ new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3() ];
		const tempVec1 = new THREE.Vector3();
		const tempVec2 = new THREE.Vector3();
		const tempNorm = new THREE.Vector3();
		const tempNorm2 = new THREE.Vector3();

		// hashes a vector
		function hashVertex( v ) {

			const x = ~ ~ ( v.x * hashMultiplier );
			const y = ~ ~ ( v.y * hashMultiplier );
			const z = ~ ~ ( v.z * hashMultiplier );
			return `${x},${y},${z}`;

		}

		const resultGeometry = geometry.toNonIndexed();
		const posAttr = resultGeometry.attributes.position;
		const vertexMap = {};

		// find all the normals shared by commonly located vertices
		for ( let i = 0, l = posAttr.count / 3; i < l; i ++ ) {

			const i3 = 3 * i;
			const a = verts[ 0 ].fromBufferAttribute( posAttr, i3 + 0 );
			const b = verts[ 1 ].fromBufferAttribute( posAttr, i3 + 1 );
			const c = verts[ 2 ].fromBufferAttribute( posAttr, i3 + 2 );
			tempVec1.subVectors( c, b );
			tempVec2.subVectors( a, b );

			// add the normal to the map for all vertices
			const normal = new THREE.Vector3().crossVectors( tempVec1, tempVec2 ).normalize();
			for ( let n = 0; n < 3; n ++ ) {

				const vert = verts[ n ];
				const hash = hashVertex( vert );
				if ( ! ( hash in vertexMap ) ) {

					vertexMap[ hash ] = [];

				}

				vertexMap[ hash ].push( normal );

			}

		}

		// average normals from all vertices that share a common location if they are within the
		// provided crease threshold
		const normalArray = new Float32Array( posAttr.count * 3 );
		const normAttr = new THREE.BufferAttribute( normalArray, 3, false );
		for ( let i = 0, l = posAttr.count / 3; i < l; i ++ ) {

			// get the face normal for this vertex
			const i3 = 3 * i;
			const a = verts[ 0 ].fromBufferAttribute( posAttr, i3 + 0 );
			const b = verts[ 1 ].fromBufferAttribute( posAttr, i3 + 1 );
			const c = verts[ 2 ].fromBufferAttribute( posAttr, i3 + 2 );
			tempVec1.subVectors( c, b );
			tempVec2.subVectors( a, b );
			tempNorm.crossVectors( tempVec1, tempVec2 ).normalize();

			// average all normals that meet the threshold and set the normal value
			for ( let n = 0; n < 3; n ++ ) {

				const vert = verts[ n ];
				const hash = hashVertex( vert );
				const otherNormals = vertexMap[ hash ];
				tempNorm2.set( 0, 0, 0 );
				for ( let k = 0, lk = otherNormals.length; k < lk; k ++ ) {

					const otherNorm = otherNormals[ k ];
					if ( tempNorm.dot( otherNorm ) > creaseDot ) {

						tempNorm2.add( otherNorm );

					}

				}

				tempNorm2.normalize();
				normAttr.setXYZ( i3 + n, tempNorm2.x, tempNorm2.y, tempNorm2.z );

			}

		}

		resultGeometry.setAttribute( 'normal', normAttr );
		return resultGeometry;

	}

	THREE.BufferGeometryUtils = {};
	THREE.BufferGeometryUtils.computeMikkTSpaceTangents = computeMikkTSpaceTangents;
	THREE.BufferGeometryUtils.computeMorphedAttributes = computeMorphedAttributes;
	THREE.BufferGeometryUtils.computeTangents = computeTangents;
	THREE.BufferGeometryUtils.deepCloneAttribute = deepCloneAttribute;
	THREE.BufferGeometryUtils.deinterleaveAttribute = deinterleaveAttribute;
	THREE.BufferGeometryUtils.deinterleaveGeometry = deinterleaveGeometry;
	THREE.BufferGeometryUtils.estimateBytesUsed = estimateBytesUsed;
	THREE.BufferGeometryUtils.interleaveAttributes = interleaveAttributes;
	THREE.BufferGeometryUtils.mergeBufferAttributes = mergeBufferAttributes;
	THREE.BufferGeometryUtils.mergeBufferGeometries = mergeBufferGeometries;
	THREE.BufferGeometryUtils.mergeGroups = mergeGroups;
	THREE.BufferGeometryUtils.mergeVertices = mergeVertices;
	THREE.BufferGeometryUtils.toCreasedNormals = toCreasedNormals;
	THREE.BufferGeometryUtils.toTrianglesDrawMode = toTrianglesDrawMode;

} )();
( function () {

	/**
 * Full-screen textured quad shader
 */

	const CopyShader = {
		uniforms: {
			'tDiffuse': {
				value: null
			},
			'opacity': {
				value: 1.0
			}
		},
		vertexShader: /* glsl */`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,
		fragmentShader: /* glsl */`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );
			gl_FragColor.a *= opacity;


		}`
	};

	THREE.CopyShader = CopyShader;

} )();
( function () {

	/**
 * Luminosity
 * http://en.wikipedia.org/wiki/Luminosity
 */

	const LuminosityHighPassShader = {
		shaderID: 'luminosityHighPass',
		uniforms: {
			'tDiffuse': {
				value: null
			},
			'luminosityThreshold': {
				value: 1.0
			},
			'smoothWidth': {
				value: 1.0
			},
			'defaultColor': {
				value: new THREE.Color( 0x000000 )
			},
			'defaultOpacity': {
				value: 0.0
			}
		},
		vertexShader: /* glsl */`

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,
		fragmentShader: /* glsl */`

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			vec3 luma = vec3( 0.299, 0.587, 0.114 );

			float v = dot( texel.xyz, luma );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`
	};

	THREE.LuminosityHighPassShader = LuminosityHighPassShader;

} )();
( function () {

	/**
 * Simple fake tilt-shift effect, modulating two pass Gaussian blur (see above) by vertical position
 *
 * - 9 samples per pass
 * - standard deviation 2.7
 * - "h" and "v" parameters should be set to "1 / width" and "1 / height"
 * - "r" parameter control where "focused" horizontal line lies
 */

	const HorizontalTiltShiftShader = {
		uniforms: {
			'tDiffuse': {
				value: null
			},
			'h': {
				value: 1.0 / 512.0
			},
			'r': {
				value: 0.35
			}
		},
		vertexShader: /* glsl */`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,
		fragmentShader: /* glsl */`

		uniform sampler2D tDiffuse;
		uniform float h;
		uniform float r;

		varying vec2 vUv;

		void main() {

			vec4 sum = vec4( 0.0 );

			float hh = h * abs( r - vUv.y );

			sum += texture2D( tDiffuse, vec2( vUv.x - 4.0 * hh, vUv.y ) ) * 0.051;
			sum += texture2D( tDiffuse, vec2( vUv.x - 3.0 * hh, vUv.y ) ) * 0.0918;
			sum += texture2D( tDiffuse, vec2( vUv.x - 2.0 * hh, vUv.y ) ) * 0.12245;
			sum += texture2D( tDiffuse, vec2( vUv.x - 1.0 * hh, vUv.y ) ) * 0.1531;
			sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y ) ) * 0.1633;
			sum += texture2D( tDiffuse, vec2( vUv.x + 1.0 * hh, vUv.y ) ) * 0.1531;
			sum += texture2D( tDiffuse, vec2( vUv.x + 2.0 * hh, vUv.y ) ) * 0.12245;
			sum += texture2D( tDiffuse, vec2( vUv.x + 3.0 * hh, vUv.y ) ) * 0.0918;
			sum += texture2D( tDiffuse, vec2( vUv.x + 4.0 * hh, vUv.y ) ) * 0.051;

			gl_FragColor = sum;

		}`
	};

	THREE.HorizontalTiltShiftShader = HorizontalTiltShiftShader;

} )();
( function () {

	/**
 * Simple fake tilt-shift effect, modulating two pass Gaussian blur (see above) by vertical position
 *
 * - 9 samples per pass
 * - standard deviation 2.7
 * - "h" and "v" parameters should be set to "1 / width" and "1 / height"
 * - "r" parameter control where "focused" horizontal line lies
 */

	const VerticalTiltShiftShader = {
		uniforms: {
			'tDiffuse': {
				value: null
			},
			'v': {
				value: 1.0 / 512.0
			},
			'r': {
				value: 0.35
			}
		},
		vertexShader: /* glsl */`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,
		fragmentShader: /* glsl */`

		uniform sampler2D tDiffuse;
		uniform float v;
		uniform float r;

		varying vec2 vUv;

		void main() {

			vec4 sum = vec4( 0.0 );

			float vv = v * abs( r - vUv.y );

			sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y - 4.0 * vv ) ) * 0.051;
			sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y - 3.0 * vv ) ) * 0.0918;
			sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y - 2.0 * vv ) ) * 0.12245;
			sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y - 1.0 * vv ) ) * 0.1531;
			sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y ) ) * 0.1633;
			sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y + 1.0 * vv ) ) * 0.1531;
			sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y + 2.0 * vv ) ) * 0.12245;
			sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y + 3.0 * vv ) ) * 0.0918;
			sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y + 4.0 * vv ) ) * 0.051;

			gl_FragColor = sum;

		}`
	};

	THREE.VerticalTiltShiftShader = VerticalTiltShiftShader;

} )();
( function () {

	class EffectComposer {

		constructor( renderer, renderTarget ) {

			this.renderer = renderer;
			if ( renderTarget === undefined ) {

				const size = renderer.getSize( new THREE.Vector2() );
				this._pixelRatio = renderer.getPixelRatio();
				this._width = size.width;
				this._height = size.height;
				renderTarget = new THREE.WebGLRenderTarget( this._width * this._pixelRatio, this._height * this._pixelRatio );
				renderTarget.texture.name = 'EffectComposer.rt1';

			} else {

				this._pixelRatio = 1;
				this._width = renderTarget.width;
				this._height = renderTarget.height;

			}

			this.renderTarget1 = renderTarget;
			this.renderTarget2 = renderTarget.clone();
			this.renderTarget2.texture.name = 'EffectComposer.rt2';
			this.writeBuffer = this.renderTarget1;
			this.readBuffer = this.renderTarget2;
			this.renderToScreen = true;
			this.passes = [];

			// dependencies

			if ( THREE.CopyShader === undefined ) {

				console.error( 'THREE.EffectComposer relies on THREE.CopyShader' );

			}

			if ( THREE.ShaderPass === undefined ) {

				console.error( 'THREE.EffectComposer relies on THREE.ShaderPass' );

			}

			this.copyPass = new THREE.ShaderPass( THREE.CopyShader );
			this.clock = new THREE.Clock();

		}
		swapBuffers() {

			const tmp = this.readBuffer;
			this.readBuffer = this.writeBuffer;
			this.writeBuffer = tmp;

		}
		addPass( pass ) {

			this.passes.push( pass );
			pass.setSize( this._width * this._pixelRatio, this._height * this._pixelRatio );

		}
		insertPass( pass, index ) {

			this.passes.splice( index, 0, pass );
			pass.setSize( this._width * this._pixelRatio, this._height * this._pixelRatio );

		}
		removePass( pass ) {

			const index = this.passes.indexOf( pass );
			if ( index !== - 1 ) {

				this.passes.splice( index, 1 );

			}

		}
		isLastEnabledPass( passIndex ) {

			for ( let i = passIndex + 1; i < this.passes.length; i ++ ) {

				if ( this.passes[ i ].enabled ) {

					return false;

				}

			}

			return true;

		}
		render( deltaTime ) {

			// deltaTime value is in seconds

			if ( deltaTime === undefined ) {

				deltaTime = this.clock.getDelta();

			}

			const currentRenderTarget = this.renderer.getRenderTarget();
			let maskActive = false;
			for ( let i = 0, il = this.passes.length; i < il; i ++ ) {

				const pass = this.passes[ i ];
				if ( pass.enabled === false ) continue;
				pass.renderToScreen = this.renderToScreen && this.isLastEnabledPass( i );
				pass.render( this.renderer, this.writeBuffer, this.readBuffer, deltaTime, maskActive );
				if ( pass.needsSwap ) {

					if ( maskActive ) {

						const context = this.renderer.getContext();
						const stencil = this.renderer.state.buffers.stencil;

						//context.stencilFunc( context.NOTEQUAL, 1, 0xffffffff );
						stencil.setFunc( context.NOTEQUAL, 1, 0xffffffff );
						this.copyPass.render( this.renderer, this.writeBuffer, this.readBuffer, deltaTime );

						//context.stencilFunc( context.EQUAL, 1, 0xffffffff );
						stencil.setFunc( context.EQUAL, 1, 0xffffffff );

					}

					this.swapBuffers();

				}

				if ( THREE.MaskPass !== undefined ) {

					if ( pass instanceof THREE.MaskPass ) {

						maskActive = true;

					} else if ( pass instanceof THREE.ClearMaskPass ) {

						maskActive = false;

					}

				}

			}

			this.renderer.setRenderTarget( currentRenderTarget );

		}
		reset( renderTarget ) {

			if ( renderTarget === undefined ) {

				const size = this.renderer.getSize( new THREE.Vector2() );
				this._pixelRatio = this.renderer.getPixelRatio();
				this._width = size.width;
				this._height = size.height;
				renderTarget = this.renderTarget1.clone();
				renderTarget.setSize( this._width * this._pixelRatio, this._height * this._pixelRatio );

			}

			this.renderTarget1.dispose();
			this.renderTarget2.dispose();
			this.renderTarget1 = renderTarget;
			this.renderTarget2 = renderTarget.clone();
			this.writeBuffer = this.renderTarget1;
			this.readBuffer = this.renderTarget2;

		}
		setSize( width, height ) {

			this._width = width;
			this._height = height;
			const effectiveWidth = this._width * this._pixelRatio;
			const effectiveHeight = this._height * this._pixelRatio;
			this.renderTarget1.setSize( effectiveWidth, effectiveHeight );
			this.renderTarget2.setSize( effectiveWidth, effectiveHeight );
			for ( let i = 0; i < this.passes.length; i ++ ) {

				this.passes[ i ].setSize( effectiveWidth, effectiveHeight );

			}

		}
		setPixelRatio( pixelRatio ) {

			this._pixelRatio = pixelRatio;
			this.setSize( this._width, this._height );

		}
		dispose() {

			this.renderTarget1.dispose();
			this.renderTarget2.dispose();
			this.copyPass.dispose();

		}

	}
	class Pass {

		constructor() {

			// if set to true, the pass is processed by the composer
			this.enabled = true;

			// if set to true, the pass indicates to swap read and write buffer after rendering
			this.needsSwap = true;

			// if set to true, the pass clears its buffer before rendering
			this.clear = false;

			// if set to true, the result of the pass is rendered to screen. This is set automatically by EffectComposer.
			this.renderToScreen = false;

		}
		setSize() {}
		render() {

			console.error( 'THREE.Pass: .render() must be implemented in derived pass.' );

		}

	}

	// Helper for passes that need to fill the viewport with a single quad.

	const _camera = new THREE.OrthographicCamera( - 1, 1, 1, - 1, 0, 1 );

	// https://github.com/mrdoob/three.js/pull/21358

	const _geometry = new THREE.BufferGeometry();
	_geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( [ - 1, 3, 0, - 1, - 1, 0, 3, - 1, 0 ], 3 ) );
	_geometry.setAttribute( 'uv', new THREE.Float32BufferAttribute( [ 0, 2, 0, 0, 2, 0 ], 2 ) );
	class FullScreenQuad {

		constructor( material ) {

			this._mesh = new THREE.Mesh( _geometry, material );

		}
		dispose() {

			this._mesh.geometry.dispose();

		}
		render( renderer ) {

			renderer.render( this._mesh, _camera );

		}
		get material() {

			return this._mesh.material;

		}
		set material( value ) {

			this._mesh.material = value;

		}

	}

	THREE.EffectComposer = EffectComposer;
	THREE.FullScreenQuad = FullScreenQuad;
	THREE.Pass = Pass;

} )();
( function () {

	class RenderPass extends THREE.Pass {

		constructor( scene, camera, overrideMaterial, clearColor, clearAlpha ) {

			super();
			this.scene = scene;
			this.camera = camera;
			this.overrideMaterial = overrideMaterial;
			this.clearColor = clearColor;
			this.clearAlpha = clearAlpha !== undefined ? clearAlpha : 0;
			this.clear = true;
			this.clearDepth = false;
			this.needsSwap = false;
			this._oldClearColor = new THREE.Color();

		}
		render( renderer, writeBuffer, readBuffer /*, deltaTime, maskActive */ ) {

			const oldAutoClear = renderer.autoClear;
			renderer.autoClear = false;
			let oldClearAlpha, oldOverrideMaterial;
			if ( this.overrideMaterial !== undefined ) {

				oldOverrideMaterial = this.scene.overrideMaterial;
				this.scene.overrideMaterial = this.overrideMaterial;

			}

			if ( this.clearColor ) {

				renderer.getClearColor( this._oldClearColor );
				oldClearAlpha = renderer.getClearAlpha();
				renderer.setClearColor( this.clearColor, this.clearAlpha );

			}

			if ( this.clearDepth ) {

				renderer.clearDepth();

			}

			renderer.setRenderTarget( this.renderToScreen ? null : readBuffer );

			// TODO: Avoid using autoClear properties, see https://github.com/mrdoob/three.js/pull/15571#issuecomment-465669600
			if ( this.clear ) renderer.clear( renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil );
			renderer.render( this.scene, this.camera );
			if ( this.clearColor ) {

				renderer.setClearColor( this._oldClearColor, oldClearAlpha );

			}

			if ( this.overrideMaterial !== undefined ) {

				this.scene.overrideMaterial = oldOverrideMaterial;

			}

			renderer.autoClear = oldAutoClear;

		}

	}

	THREE.RenderPass = RenderPass;

} )();
( function () {

	class ShaderPass extends THREE.Pass {

		constructor( shader, textureID ) {

			super();
			this.textureID = textureID !== undefined ? textureID : 'tDiffuse';
			if ( shader instanceof THREE.ShaderMaterial ) {

				this.uniforms = shader.uniforms;
				this.material = shader;

			} else if ( shader ) {

				this.uniforms = THREE.UniformsUtils.clone( shader.uniforms );
				this.material = new THREE.ShaderMaterial( {
					defines: Object.assign( {}, shader.defines ),
					uniforms: this.uniforms,
					vertexShader: shader.vertexShader,
					fragmentShader: shader.fragmentShader
				} );

			}

			this.fsQuad = new THREE.FullScreenQuad( this.material );

		}
		render( renderer, writeBuffer, readBuffer /*, deltaTime, maskActive */ ) {

			if ( this.uniforms[ this.textureID ] ) {

				this.uniforms[ this.textureID ].value = readBuffer.texture;

			}

			this.fsQuad.material = this.material;
			if ( this.renderToScreen ) {

				renderer.setRenderTarget( null );
				this.fsQuad.render( renderer );

			} else {

				renderer.setRenderTarget( writeBuffer );
				// TODO: Avoid using autoClear properties, see https://github.com/mrdoob/three.js/pull/15571#issuecomment-465669600
				if ( this.clear ) renderer.clear( renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil );
				this.fsQuad.render( renderer );

			}

		}
		dispose() {

			this.material.dispose();
			this.fsQuad.dispose();

		}

	}

	THREE.ShaderPass = ShaderPass;

} )();
( function () {

	/**
 * UnrealBloomPass is inspired by the bloom pass of Unreal Engine. It creates a
 * mip map chain of bloom textures and blurs them with different radii. Because
 * of the weighted combination of mips, and because larger blurs are done on
 * higher mips, this effect provides good quality and performance.
 *
 * Reference:
 * - https://docs.unrealengine.com/latest/INT/Engine/Rendering/PostProcessEffects/Bloom/
 */
	class UnrealBloomPass extends THREE.Pass {

		constructor( resolution, strength, radius, threshold ) {

			super();
			this.strength = strength !== undefined ? strength : 1;
			this.radius = radius;
			this.threshold = threshold;
			this.resolution = resolution !== undefined ? new THREE.Vector2( resolution.x, resolution.y ) : new THREE.Vector2( 256, 256 );

			// create color only once here, reuse it later inside the render function
			this.clearColor = new THREE.Color( 0, 0, 0 );

			// render targets
			this.renderTargetsHorizontal = [];
			this.renderTargetsVertical = [];
			this.nMips = 5;
			let resx = Math.round( this.resolution.x / 2 );
			let resy = Math.round( this.resolution.y / 2 );
			this.renderTargetBright = new THREE.WebGLRenderTarget( resx, resy );
			this.renderTargetBright.texture.name = 'UnrealBloomPass.bright';
			this.renderTargetBright.texture.generateMipmaps = false;
			for ( let i = 0; i < this.nMips; i ++ ) {

				const renderTargetHorizonal = new THREE.WebGLRenderTarget( resx, resy );
				renderTargetHorizonal.texture.name = 'UnrealBloomPass.h' + i;
				renderTargetHorizonal.texture.generateMipmaps = false;
				this.renderTargetsHorizontal.push( renderTargetHorizonal );
				const renderTargetVertical = new THREE.WebGLRenderTarget( resx, resy );
				renderTargetVertical.texture.name = 'UnrealBloomPass.v' + i;
				renderTargetVertical.texture.generateMipmaps = false;
				this.renderTargetsVertical.push( renderTargetVertical );
				resx = Math.round( resx / 2 );
				resy = Math.round( resy / 2 );

			}

			// luminosity high pass material

			if ( THREE.LuminosityHighPassShader === undefined ) console.error( 'THREE.UnrealBloomPass relies on THREE.LuminosityHighPassShader' );
			const highPassShader = THREE.LuminosityHighPassShader;
			this.highPassUniforms = THREE.UniformsUtils.clone( highPassShader.uniforms );
			this.highPassUniforms[ 'luminosityThreshold' ].value = threshold;
			this.highPassUniforms[ 'smoothWidth' ].value = 0.01;
			this.materialHighPassFilter = new THREE.ShaderMaterial( {
				uniforms: this.highPassUniforms,
				vertexShader: highPassShader.vertexShader,
				fragmentShader: highPassShader.fragmentShader,
				defines: {}
			} );

			// Gaussian Blur Materials
			this.separableBlurMaterials = [];
			const kernelSizeArray = [ 3, 5, 7, 9, 11 ];
			resx = Math.round( this.resolution.x / 2 );
			resy = Math.round( this.resolution.y / 2 );
			for ( let i = 0; i < this.nMips; i ++ ) {

				this.separableBlurMaterials.push( this.getSeperableBlurMaterial( kernelSizeArray[ i ] ) );
				this.separableBlurMaterials[ i ].uniforms[ 'texSize' ].value = new THREE.Vector2( resx, resy );
				resx = Math.round( resx / 2 );
				resy = Math.round( resy / 2 );

			}

			// Composite material
			this.compositeMaterial = this.getCompositeMaterial( this.nMips );
			this.compositeMaterial.uniforms[ 'blurTexture1' ].value = this.renderTargetsVertical[ 0 ].texture;
			this.compositeMaterial.uniforms[ 'blurTexture2' ].value = this.renderTargetsVertical[ 1 ].texture;
			this.compositeMaterial.uniforms[ 'blurTexture3' ].value = this.renderTargetsVertical[ 2 ].texture;
			this.compositeMaterial.uniforms[ 'blurTexture4' ].value = this.renderTargetsVertical[ 3 ].texture;
			this.compositeMaterial.uniforms[ 'blurTexture5' ].value = this.renderTargetsVertical[ 4 ].texture;
			this.compositeMaterial.uniforms[ 'bloomStrength' ].value = strength;
			this.compositeMaterial.uniforms[ 'bloomRadius' ].value = 0.1;
			this.compositeMaterial.needsUpdate = true;
			const bloomFactors = [ 1.0, 0.8, 0.6, 0.4, 0.2 ];
			this.compositeMaterial.uniforms[ 'bloomFactors' ].value = bloomFactors;
			this.bloomTintColors = [ new THREE.Vector3( 1, 1, 1 ), new THREE.Vector3( 1, 1, 1 ), new THREE.Vector3( 1, 1, 1 ), new THREE.Vector3( 1, 1, 1 ), new THREE.Vector3( 1, 1, 1 ) ];
			this.compositeMaterial.uniforms[ 'bloomTintColors' ].value = this.bloomTintColors;

			// copy material
			if ( THREE.CopyShader === undefined ) {

				console.error( 'THREE.UnrealBloomPass relies on THREE.CopyShader' );

			}

			const copyShader = THREE.CopyShader;
			this.copyUniforms = THREE.UniformsUtils.clone( copyShader.uniforms );
			this.copyUniforms[ 'opacity' ].value = 1.0;
			this.materialCopy = new THREE.ShaderMaterial( {
				uniforms: this.copyUniforms,
				vertexShader: copyShader.vertexShader,
				fragmentShader: copyShader.fragmentShader,
				blending: THREE.AdditiveBlending,
				depthTest: false,
				depthWrite: false,
				transparent: true
			} );
			this.enabled = true;
			this.needsSwap = false;
			this._oldClearColor = new THREE.Color();
			this.oldClearAlpha = 1;
			this.basic = new THREE.MeshBasicMaterial();
			this.fsQuad = new THREE.FullScreenQuad( null );

		}
		dispose() {

			for ( let i = 0; i < this.renderTargetsHorizontal.length; i ++ ) {

				this.renderTargetsHorizontal[ i ].dispose();

			}

			for ( let i = 0; i < this.renderTargetsVertical.length; i ++ ) {

				this.renderTargetsVertical[ i ].dispose();

			}

			this.renderTargetBright.dispose();

			//

			for ( let i = 0; i < this.separableBlurMaterials.length; i ++ ) {

				this.separableBlurMaterials[ i ].dispose();

			}

			this.compositeMaterial.dispose();
			this.materialCopy.dispose();
			this.basic.dispose();

			//

			this.fsQuad.dispose();

		}
		setSize( width, height ) {

			let resx = Math.round( width / 2 );
			let resy = Math.round( height / 2 );
			this.renderTargetBright.setSize( resx, resy );
			for ( let i = 0; i < this.nMips; i ++ ) {

				this.renderTargetsHorizontal[ i ].setSize( resx, resy );
				this.renderTargetsVertical[ i ].setSize( resx, resy );
				this.separableBlurMaterials[ i ].uniforms[ 'texSize' ].value = new THREE.Vector2( resx, resy );
				resx = Math.round( resx / 2 );
				resy = Math.round( resy / 2 );

			}

		}
		render( renderer, writeBuffer, readBuffer, deltaTime, maskActive ) {

			renderer.getClearColor( this._oldClearColor );
			this.oldClearAlpha = renderer.getClearAlpha();
			const oldAutoClear = renderer.autoClear;
			renderer.autoClear = false;
			renderer.setClearColor( this.clearColor, 0 );
			if ( maskActive ) renderer.state.buffers.stencil.setTest( false );

			// Render input to screen

			if ( this.renderToScreen ) {

				this.fsQuad.material = this.basic;
				this.basic.map = readBuffer.texture;
				renderer.setRenderTarget( null );
				renderer.clear();
				this.fsQuad.render( renderer );

			}

			// 1. Extract Bright Areas

			this.highPassUniforms[ 'tDiffuse' ].value = readBuffer.texture;
			this.highPassUniforms[ 'luminosityThreshold' ].value = this.threshold;
			this.fsQuad.material = this.materialHighPassFilter;
			renderer.setRenderTarget( this.renderTargetBright );
			renderer.clear();
			this.fsQuad.render( renderer );

			// 2. Blur All the mips progressively

			let inputRenderTarget = this.renderTargetBright;
			for ( let i = 0; i < this.nMips; i ++ ) {

				this.fsQuad.material = this.separableBlurMaterials[ i ];
				this.separableBlurMaterials[ i ].uniforms[ 'colorTexture' ].value = inputRenderTarget.texture;
				this.separableBlurMaterials[ i ].uniforms[ 'direction' ].value = UnrealBloomPass.BlurDirectionX;
				renderer.setRenderTarget( this.renderTargetsHorizontal[ i ] );
				renderer.clear();
				this.fsQuad.render( renderer );
				this.separableBlurMaterials[ i ].uniforms[ 'colorTexture' ].value = this.renderTargetsHorizontal[ i ].texture;
				this.separableBlurMaterials[ i ].uniforms[ 'direction' ].value = UnrealBloomPass.BlurDirectionY;
				renderer.setRenderTarget( this.renderTargetsVertical[ i ] );
				renderer.clear();
				this.fsQuad.render( renderer );
				inputRenderTarget = this.renderTargetsVertical[ i ];

			}

			// Composite All the mips

			this.fsQuad.material = this.compositeMaterial;
			this.compositeMaterial.uniforms[ 'bloomStrength' ].value = this.strength;
			this.compositeMaterial.uniforms[ 'bloomRadius' ].value = this.radius;
			this.compositeMaterial.uniforms[ 'bloomTintColors' ].value = this.bloomTintColors;
			renderer.setRenderTarget( this.renderTargetsHorizontal[ 0 ] );
			renderer.clear();
			this.fsQuad.render( renderer );

			// Blend it additively over the input texture

			this.fsQuad.material = this.materialCopy;
			this.copyUniforms[ 'tDiffuse' ].value = this.renderTargetsHorizontal[ 0 ].texture;
			if ( maskActive ) renderer.state.buffers.stencil.setTest( true );
			if ( this.renderToScreen ) {

				renderer.setRenderTarget( null );
				this.fsQuad.render( renderer );

			} else {

				renderer.setRenderTarget( readBuffer );
				this.fsQuad.render( renderer );

			}

			// Restore renderer settings

			renderer.setClearColor( this._oldClearColor, this.oldClearAlpha );
			renderer.autoClear = oldAutoClear;

		}
		getSeperableBlurMaterial( kernelRadius ) {

			return new THREE.ShaderMaterial( {
				defines: {
					'KERNEL_RADIUS': kernelRadius,
					'SIGMA': kernelRadius
				},
				uniforms: {
					'colorTexture': {
						value: null
					},
					'texSize': {
						value: new THREE.Vector2( 0.5, 0.5 )
					},
					'direction': {
						value: new THREE.Vector2( 0.5, 0.5 )
					}
				},
				vertexShader: `varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,
				fragmentShader: `#include <common>
				varying vec2 vUv;
				uniform sampler2D colorTexture;
				uniform vec2 texSize;
				uniform vec2 direction;

				float gaussianPdf(in float x, in float sigma) {
					return 0.39894 * exp( -0.5 * x * x/( sigma * sigma))/sigma;
				}
				void main() {
					vec2 invSize = 1.0 / texSize;
					float fSigma = float(SIGMA);
					float weightSum = gaussianPdf(0.0, fSigma);
					vec3 diffuseSum = texture2D( colorTexture, vUv).rgb * weightSum;
					for( int i = 1; i < KERNEL_RADIUS; i ++ ) {
						float x = float(i);
						float w = gaussianPdf(x, fSigma);
						vec2 uvOffset = direction * invSize * x;
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset).rgb;
						diffuseSum += (sample1 + sample2) * w;
						weightSum += 2.0 * w;
					}
					gl_FragColor = vec4(diffuseSum/weightSum, 1.0);
				}`
			} );

		}
		getCompositeMaterial( nMips ) {

			return new THREE.ShaderMaterial( {
				defines: {
					'NUM_MIPS': nMips
				},
				uniforms: {
					'blurTexture1': {
						value: null
					},
					'blurTexture2': {
						value: null
					},
					'blurTexture3': {
						value: null
					},
					'blurTexture4': {
						value: null
					},
					'blurTexture5': {
						value: null
					},
					'bloomStrength': {
						value: 1.0
					},
					'bloomFactors': {
						value: null
					},
					'bloomTintColors': {
						value: null
					},
					'bloomRadius': {
						value: 0.0
					}
				},
				vertexShader: `varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,
				fragmentShader: `varying vec2 vUv;
				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor(const in float factor) {
					float mirrorFactor = 1.2 - factor;
					return mix(factor, mirrorFactor, bloomRadius);
				}

				void main() {
					gl_FragColor = bloomStrength * ( lerpBloomFactor(bloomFactors[0]) * vec4(bloomTintColors[0], 1.0) * texture2D(blurTexture1, vUv) +
						lerpBloomFactor(bloomFactors[1]) * vec4(bloomTintColors[1], 1.0) * texture2D(blurTexture2, vUv) +
						lerpBloomFactor(bloomFactors[2]) * vec4(bloomTintColors[2], 1.0) * texture2D(blurTexture3, vUv) +
						lerpBloomFactor(bloomFactors[3]) * vec4(bloomTintColors[3], 1.0) * texture2D(blurTexture4, vUv) +
						lerpBloomFactor(bloomFactors[4]) * vec4(bloomTintColors[4], 1.0) * texture2D(blurTexture5, vUv) );
				}`
			} );

		}

	}
	UnrealBloomPass.BlurDirectionX = new THREE.Vector2( 1.0, 0.0 );
	UnrealBloomPass.BlurDirectionY = new THREE.Vector2( 0.0, 1.0 );

	THREE.UnrealBloomPass = UnrealBloomPass;

} )();
