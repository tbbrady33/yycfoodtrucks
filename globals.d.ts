// Type declarations for CSS side-effect imports used by NativeWind / gluestack
// (`import './foo.css'`) and for CSS modules consumed on web
// (`import classes from './foo.module.css'`).
declare module '*.css';
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
