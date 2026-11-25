# CG3207 Lab Templates

## Suggestions for using this repository

* You may choose to clone this repository, and then set the remote to a private repository of your own. Otherwise, an easier option is to simply download the repository as a zip file, and upload the contents to your own private repository.

* Please DO NOT FORK this repository to do your lab work. Forks of this repository will be public, exposing your work to the internet. Submissions of code from public repositories will be considered plagiarism, even if they're your own repository!

* Educators are welcome to fork this repository (and all others in this organisation) for their own teaching.

* Create a separate folder to contain a Vivado project, which you can use for Lab 2 through 4. 

* Use the GitHub Releases and Milestones functions to mark your progress. We suggest creating a release for every lab assignment, with your code submission zip file as the release file. 

## Build instructions

### Prerequisites

You must have Python 3.12 or greater installed on your machine. Older versions are not guaranteed to work. 

The environment is tested on Windows with WSL, macOS, and multiple Linux distributions. I have no idea if it will work on a native Windows environment - it should, but I haven't and do not intend to try. 

You may choose to use [uv](https://docs.astral.sh/uv/), [Anaconda](https://www.anaconda.com/download), or just plain old pip to set up the development environment. 

Clone the repository to your machine to get started. The instructions below will assume you have a terminal opened, and the current working directory is the cloned repository. 

The site is built with [Zensical](https://zensical.org). Its configuration is in `zensical.toml`.

### Using uv (recommended)

Simply run `uv sync`. This will read `pyproject.toml` and install all the required dependencies. 

To run the development server, run `uv run -- zensical serve`.

### Using conda

Create a new conda environment, let's say by running `conda create -n zensical-env python=3.12 pip`.

Switch to the new conda environment by running `conda activate zensical-env`. 

Install Zensical by running `pip install -r requirements.txt`.

To run the development server, run `zensical serve`. 

### Using pip

Create a new virtual environment using `python -m venv .venv`. 

Activate the new virtual environment using `source .venv/bin/activate`. Use `activate.csh`, `activate.fish` or `activate.ps1` as required by whatever shell you use. 

Install the requirements by running `pip install -r requirements.txt`. 

To run the development server, run `zensical serve`. 

### Building and deploying

Run `zensical build` to build the site into `site/`. Pushing to `main` builds the site in GitHub Actions and publishes it to the `gh-pages` branch.

## License 

[NUS CG3207 Lab Assignments](https://github.com/nus-cg3207/labs) © 2024 by [NUS CG3207 Team](https://github.com/nus-cg3207) is licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/?ref=chooser-v1)  
