# vdom-benchmark-morphdom

[Virtual DOM Benchmark](https://github.com/vdom-benchmark/vdom-benchmark)
implementation for
[morphdom](https://github.com/patrick-steele-idem/morphdom) library.

## Development

### Install dependencies

```sh
$ npm install
```

### Development server

```sh
$ gulp serve
```

By default when you access `index.html` page it will wait for
benchmark test cases from the parent window. To use custom test cases,
use `data` attribute in query string, for example:
`http://localhost:3000/?data=http://vdom-benchmark.github.io/vdom-benchmark/generator.js`
will use test cases from the vdom benchmark.

### Release build

```sh
$ NODE_ENV=production gulp
```

### Deploy to github pages

```sh
$ NODE_ENV=production gulp deploy
```
