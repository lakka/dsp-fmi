#!/bin/bash
nice -n 19 python traingaussian.py -p|ts '[%Y-%m-%d %H:%M:%S]' >> train.log
rm .train.pid 2> /dev/null
