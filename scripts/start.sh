#!/bin/bash

if [ $NODE_ENV = 'production' ] || [ $NODE_ENV = 'staging' ]
then
  npm run build
  node src/index.js
  exit
fi

npm run dev