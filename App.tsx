import * as React from 'react';
import { ExpoWebGLRenderingContext, GLView } from 'expo-gl';
import { Scene, PerspectiveCamera, BoxGeometry, MeshStandardMaterial, Mesh, AmbientLight, DirectionalLight, WebGLRenderer, Vector3, Vector2, Raycaster, Euler, Color, Fog } from 'three';
import { View, StyleSheet, Dimensions, PanResponder, Animated } from 'react-native';

// Block types
const BLOCK_TYPES = {
  GRASS: 0,
  DIRT: 1,
  STONE: 2,
  WOOD: 3,
};

// Block colors
const BLOCK_COLORS = {
  [BLOCK_TYPES.GRASS]: 0x00ff00,
  [BLOCK_TYPES.DIRT]: 0x8b4513,
  [BLOCK_TYPES.STONE]: 0x808080,
  [BLOCK_TYPES.WOOD]: 0x8b4513,
};

// Movement speed
const MOVEMENT_SPEED = 0.015;
const ROTATION_SPEED = 0.002;
const HEAD_BOB_AMPLITUDE = 0.05;
const HEAD_BOB_FREQUENCY = 0.1;

const JOYSTICK_SIZE = 100;
const JOYSTICK_BASE_COLOR = 'rgba(255, 255, 255, 0.3)';
const JOYSTICK_STICK_COLOR = 'rgba(255, 255, 255, 0.5)';

// Sky colors
const SKY_COLORS = {
  TOP: 0x87CEEB,    // Sky blue
  BOTTOM: 0xE0F6FF, // Light blue
};

interface JoystickProps {
  onMove: (x: number, y: number) => void;
}

const VirtualJoystick: React.FC<JoystickProps> = ({ onMove }) => {
  const pan = React.useRef(new Animated.ValueXY()).current;
  const [stickPosition, setStickPosition] = React.useState({ x: 0, y: 0 });
  const lastMoveTime = React.useRef(Date.now());

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({
          x: stickPosition.x,
          y: stickPosition.y,
        });
        pan.setValue({ x: 0, y: 0 });
        lastMoveTime.current = Date.now();
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        pan.flattenOffset();
        pan.setValue({ x: 0, y: 0 });
        setStickPosition({ x: 0, y: 0 });
        onMove(0, 0);
      },
      onPanResponderTerminate: () => {
        pan.flattenOffset();
        pan.setValue({ x: 0, y: 0 });
        setStickPosition({ x: 0, y: 0 });
        onMove(0, 0);
      },
    })
  ).current;

  React.useEffect(() => {
    const listener = pan.addListener((value) => {
      const currentTime = Date.now();
      const timeDiff = currentTime - lastMoveTime.current;
      
      // Only update if enough time has passed (throttle updates)
      if (timeDiff >= 16) { // ~60fps
        const distance = Math.min(JOYSTICK_SIZE / 2, Math.sqrt(value.x * value.x + value.y * value.y));
        const angle = Math.atan2(value.y, value.x);
        const newPosition = {
          x: distance * Math.cos(angle),
          y: distance * Math.sin(angle),
        };
        setStickPosition(newPosition);
        
        // Normalize the values for movement
        const normalizedX = value.x / (JOYSTICK_SIZE / 2);
        const normalizedY = value.y / (JOYSTICK_SIZE / 2);
        onMove(normalizedX, normalizedY);
        
        lastMoveTime.current = currentTime;
      }
    });

    return () => {
      pan.removeListener(listener);
    };
  }, [pan, onMove]);

  return (
    <View style={styles.joystickContainer}>
      <View style={styles.joystickBase} />
      <Animated.View
        style={[
          styles.joystickStick,
          {
            transform: [
              { translateX: stickPosition.x },
              { translateY: stickPosition.y },
            ],
          },
        ]}
        {...panResponder.panHandlers}
      />
    </View>
  );
};

export default function App() {
  let timeout: number;
  let camera: PerspectiveCamera;
  let scene: Scene;
  let renderer: WebGLRenderer;
  let raycaster: Raycaster;
  let blocks: Mesh[] = [];
  let selectedBlockType = BLOCK_TYPES.GRASS;
  
  // Player state
  const playerPosition = new Vector3(0, 2, 0);
  const playerRotation = new Euler(0, 0, 0);
  const moveForward = React.useRef(false);
  const moveBackward = React.useRef(false);
  const moveLeft = React.useRef(false);
  const moveRight = React.useRef(false);
  const isPointerLocked = React.useRef(false);
  const time = React.useRef(0);
  const isMoving = React.useRef(false);

  const createBlock = (position: Vector3, type: number) => {
    const geometry = new BoxGeometry(1, 1, 1);
    const material = new MeshStandardMaterial({
      color: BLOCK_COLORS[type],
    });
    const block = new Mesh(geometry, material);
    block.position.copy(position);
    block.userData.type = type;
    scene.add(block);
    blocks.push(block);
  };

  const generateTerrain = () => {
    // Create a simple terrain
    for (let x = -5; x < 5; x++) {
      for (let z = -5; z < 5; z++) {
        const height = Math.floor(Math.random() * 3) + 1;
        for (let y = 0; y < height; y++) {
          const type = y === height - 1 ? BLOCK_TYPES.GRASS : 
                      y === height - 2 ? BLOCK_TYPES.DIRT : 
                      BLOCK_TYPES.STONE;
          createBlock(new Vector3(x, y, z), type);
        }
      }
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    switch (event.key.toLowerCase()) {
      case 'w':
        moveForward.current = true;
        break;
      case 's':
        moveBackward.current = true;
        break;
      case 'a':
        moveLeft.current = true;
        break;
      case 'd':
        moveRight.current = true;
        break;
    }
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    switch (event.key.toLowerCase()) {
      case 'w':
        moveForward.current = false;
        break;
      case 's':
        moveBackward.current = false;
        break;
      case 'a':
        moveLeft.current = false;
        break;
      case 'd':
        moveRight.current = false;
        break;
    }
  };

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        isPointerLocked.current = true;
      },
      onPanResponderMove: (_, gestureState) => {
        if (!isPointerLocked.current) return;
        
        // Horizontal rotation (left/right) - Y axis
        playerRotation.y -= gestureState.dx * ROTATION_SPEED;
        
        // Vertical rotation (up/down) - X axis
        playerRotation.x -= gestureState.dy * ROTATION_SPEED;
        
        // Lock Z axis (roll) to 0
        playerRotation.z = 0;
        
        // Limit vertical rotation to prevent over-rotation
        playerRotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, playerRotation.x));
      },
      onPanResponderRelease: () => {
        isPointerLocked.current = false;
      },
      onPanResponderTerminate: () => {
        isPointerLocked.current = false;
      },
    })
  ).current;

  const updatePlayerMovement = () => {
    const direction = new Vector3();
    
    if (moveForward.current) direction.z -= 1;
    if (moveBackward.current) direction.z += 1;
    if (moveLeft.current) direction.x -= 1;
    if (moveRight.current) direction.x += 1;
    
    direction.normalize();
    
    // Apply rotation to movement direction (only Y axis for horizontal movement)
    const rotationMatrix = new Euler(0, playerRotation.y, 0);
    direction.applyEuler(rotationMatrix);
    
    // Add vertical movement based on camera pitch
    if (moveForward.current || moveBackward.current) {
      direction.y = Math.sin(playerRotation.x);
    }
    
    // Update position
    playerPosition.add(direction.multiplyScalar(MOVEMENT_SPEED));
    
    // Update time for head bobbing
    time.current += 0.016; // Assuming 60fps
    
    // Calculate head bobbing
    const headBobY = isMoving.current ? 
      Math.sin(time.current * HEAD_BOB_FREQUENCY) * HEAD_BOB_AMPLITUDE : 0;
    
    // Update camera position and rotation with head bobbing
    camera.position.copy(playerPosition);
    camera.position.y += headBobY;
    camera.rotation.set(playerRotation.x, playerRotation.y, 0);
    
    // Update isMoving state
    isMoving.current = moveForward.current || moveBackward.current || 
                      moveLeft.current || moveRight.current;
  };

  const handleTouch = (event: any) => {
    const touch = event.nativeEvent;
    const { width, height } = Dimensions.get('window');
    const x = (touch.locationX / width) * 2 - 1;
    const y = -(touch.locationY / height) * 2 + 1;

    raycaster.setFromCamera(new Vector2(x, y), camera);
    const intersects = raycaster.intersectObjects(blocks);

    if (intersects.length > 0) {
      const block = intersects[0].object as Mesh;
      const position = block.position.clone();
      
      if (event.type === 'press') {
        // Remove block
        scene.remove(block);
        blocks = blocks.filter(b => b !== block);
      } else if (event.type === 'longPress') {
        // Add block
        const normal = intersects[0].face?.normal;
        if (normal) {
          position.add(normal);
          createBlock(position, selectedBlockType);
        }
      }
    }
  };

  const handleJoystickMove = (x: number, y: number) => {
    // Convert joystick input to movement direction
    const magnitude = Math.min(1, Math.sqrt(x * x + y * y));
    
    // Only update movement if there's significant input
    if (magnitude > 0.1) {
      // Calculate movement direction based on joystick position
      // Normalize the input values
      const normalizedX = x / magnitude;
      const normalizedY = y / magnitude;
      
      // Set movement directions based on normalized values
      moveForward.current = normalizedY < -0.5;
      moveBackward.current = normalizedY > 0.5;
      moveLeft.current = normalizedX < -0.5;
      moveRight.current = normalizedX > 0.5;
      
      isMoving.current = true;
    } else {
      // Reset all movement when joystick is released or near center
      moveForward.current = false;
      moveBackward.current = false;
      moveLeft.current = false;
      moveRight.current = false;
      isMoving.current = false;
    }
  };

  const createSkybox = () => {
    // Create a large box for the sky
    const skyGeometry = new BoxGeometry(1000, 1000, 1000);
    const skyMaterial = new MeshStandardMaterial({
      color: SKY_COLORS.TOP,
      side: 1, // Render the inside of the box
      transparent: true,
      opacity: 0.8,
    });
    const skybox = new Mesh(skyGeometry, skyMaterial);
    scene.add(skybox);
    return skybox;
  };

  React.useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.gameContainer} {...panResponder.panHandlers}>
        <GLView
          style={{ flex: 1 }}
          onContextCreate={async (gl: ExpoWebGLRenderingContext) => {
            // Create a WebGLRenderer without a DOM element
            renderer = new WebGLRenderer({
              canvas: gl.canvas,
              context: gl,
              antialias: true,
            });
            renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);

            // Create a new Scene
            scene = new Scene();
            
            // Add fog for depth
            scene.fog = new Fog(SKY_COLORS.BOTTOM, 20, 100);

            // Create a camera
            camera = new PerspectiveCamera(
              70, // Slightly wider FOV for better visibility
              gl.drawingBufferWidth / gl.drawingBufferHeight,
              0.1,
              1000
            );
            camera.position.copy(playerPosition);

            // Create raycaster
            raycaster = new Raycaster();

            // Add lights
            const ambientLight = new AmbientLight(0x404040);
            scene.add(ambientLight);

            const directionalLight = new DirectionalLight(0xffffff, 1);
            directionalLight.position.set(1, 1, 1);
            scene.add(directionalLight);

            // Create skybox
            const skybox = createSkybox();

            // Generate terrain
            generateTerrain();

            // Animation loop
            const render = () => {
              timeout = requestAnimationFrame(render);
              updatePlayerMovement();
              
              // Update skybox position to follow camera
              skybox.position.copy(camera.position);
              
              renderer.render(scene, camera);
              gl.endFrameEXP();
            };
            render();
          }}
        />
      </View>
      <VirtualJoystick onMove={handleJoystickMove} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  gameContainer: {
    flex: 1,
  },
  joystickContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    width: JOYSTICK_SIZE,
    height: JOYSTICK_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  joystickBase: {
    position: 'absolute',
    width: JOYSTICK_SIZE,
    height: JOYSTICK_SIZE,
    borderRadius: JOYSTICK_SIZE / 2,
    backgroundColor: JOYSTICK_BASE_COLOR,
  },
  joystickStick: {
    width: JOYSTICK_SIZE / 2,
    height: JOYSTICK_SIZE / 2,
    borderRadius: JOYSTICK_SIZE / 4,
    backgroundColor: JOYSTICK_STICK_COLOR,
  },
});