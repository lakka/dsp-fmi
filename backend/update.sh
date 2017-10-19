#!/bin/bash
mkdir -p data
mkdir -p public
python ftpfetch.py
python parsehdf5.py
