/// <reference types="vite/client" />

// Declare module for PNG images
declare module '*.png' {
    const value: string;
    export default value;
}

// Declare module for other image types
declare module '*.jpg' {
    const value: string;
    export default value;
}

declare module '*.jpeg' {
    const value: string;
    export default value;
}

declare module '*.gif' {
    const value: string;
    export default value;
}

declare module '*.svg' {
    const value: string;
    export default value;
}