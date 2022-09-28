import click

stdin_text = click.get_text_stream("stdin").read()


@click.command()
def run():
    print(stdin_text)


if __name__ == "__main__":
    run()
