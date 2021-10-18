import * as React from "react";

import { Button } from "app2/Button";

const App = () => (
  <div>
    <h1>Typescript</h1>
    <h2>App 1</h2>
    <React.Suspense fallback="Loading Button">
      <Button customLabel="Label is required" />
    </React.Suspense>
  </div>
);

export default App;
