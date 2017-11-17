#!/bin/bash

if [[ ! -d 'backend' ]]; then
    echo "This script must be run from project root!"
    exit 1
fi

wget -mnd --accept '*.json' 'http://fmi-ds-backend.h4x0rb34.rs/' -P backend/public/
