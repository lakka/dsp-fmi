#!/bin/bash
mkdir -p data data-nasa
mkdir -p public public-nasa
python ftpfetch.py
python parsehdf5.py
